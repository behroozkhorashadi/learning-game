import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeCamera, PHOTO } from '@app/profiles/profile_photo_fixtures.test.lib.ts'
import { bindArtStudio, type ArtStudioProps } from './art_studio.effect.ui.tsx'
import { fakeArmory, type FakeArmory } from './horde_fakes.test.ui.tsx'

afterEach(cleanup)

async function settle(): Promise<void> {
  await act(async () => undefined)
}

const press = (name: string): void => {
  fireEvent.click(screen.getByRole('button', { name }))
}

async function open(armory: FakeArmory, overrides: Partial<ArtStudioProps> = {}, camera = fakeCamera()): Promise<{ readonly onSpent: ReturnType<typeof vi.fn>; readonly onBack: ReturnType<typeof vi.fn> }> {
  const ArtStudio = bindArtStudio({ camera, gallery: armory.gallery, createArt: armory.createArt })
  const onSpent = vi.fn()
  const onBack = vi.fn()
  render(<ArtStudio profileId={1} balance={armory.state().balance} price={300} onSpent={onSpent} onBack={onBack} {...overrides} />)
  await settle()
  return { onSpent, onBack }
}

async function takeSelfie(): Promise<void> {
  press('Open camera')
  await settle()
  press('Take selfie')
}

describe('ArtStudio', () => {
  it('takes a selfie, makes art in the chosen style with the idea, and keeps it in the gallery', async () => {
    const armory = fakeArmory({ balance: 400 })
    const { onSpent } = await open(armory)
    expect(screen.getByText('Your gallery is empty. Make your first piece!')).toBeTruthy()
    await takeSelfie()
    expect(screen.getByRole('img', { name: 'Your selfie' }).getAttribute('src')).toBe(PHOTO)
    press('🚀 Space Ranger')
    fireEvent.change(screen.getByRole('textbox', { name: 'Add an idea (optional)' }), { target: { value: ' a jetpack ' } })
    press('Create art · 300 points')
    await settle()
    expect(armory.artRequests).toEqual([{ image_data_url: PHOTO, style: 'space_ranger', idea: 'a jetpack' }])
    expect(screen.getByRole('img', { name: 'Your new Space Ranger art' })).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Your gallery' })).getByRole('img', { name: 'Space Ranger: a jetpack' })).toBeTruthy()
    expect(onSpent).toHaveBeenCalledTimes(1)
    expect(armory.state().balance).toBe(100)
  })

  it("can't create without a selfie or enough points, and says how many more are needed", async () => {
    const armory = fakeArmory({ balance: 120 })
    await open(armory)
    await takeSelfie()
    press('Create art · 300 points')
    await settle()
    expect(armory.artRequests).toEqual([])
    expect(screen.getByText('You need 180 more points. Play a round of Zombie Horde to earn them!')).toBeTruthy()
  })

  it('shows why art could not be made, and charges nothing', async () => {
    const armory = fakeArmory({ balance: 400, artAvailable: false })
    const { onSpent } = await open(armory)
    await takeSelfie()
    press('Create art · 300 points')
    await settle()
    expect(screen.getByRole('alert').textContent).toContain('no points were spent')
    expect(onSpent).not.toHaveBeenCalled()
    expect(armory.state().balance).toBe(400)
  })

  it('explains a camera that is turned off', async () => {
    await open(fakeArmory({ balance: 400 }), {}, fakeCamera('denied'))
    press('Open camera')
    await settle()
    expect(screen.getByText(/camera is turned off/)).toBeTruthy()
  })

  it('retakes a selfie and goes back', async () => {
    const { onBack } = await open(fakeArmory({ balance: 400 }))
    await takeSelfie()
    press('Retake')
    await settle()
    expect(screen.getByRole('button', { name: 'Take selfie' })).toBeTruthy()
    press('Back')
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
