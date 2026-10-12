"""Zombie Horde: a free-roaming zombie round (hold out 60 seconds, then overtime for
a record) over the same arithmetic facts as Fact Fluency (Equation Outbreak). The item shape, difficulty tiers, and
practice-config support are Fact Fluency's unchanged: only the id, title, and
tagline differ, so attempts and levels are tracked per game while the content stays
in one place. Everything zombie-shaped (movement, health, cover, the armory) is the
client's; see frontend/src/horde/.
"""

from app.play.games.fact_fluency_reducers_pure import FactFluencyGame
from app.play.play_schemas_pure import GameMetadata


class ZombieHordeGame(FactFluencyGame):
    metadata = GameMetadata(
        id="zombie_horde",
        title="Zombie Horde",
        tagline="Find the right zombie. Hold the line for 60 seconds, then go for a record.",
        skill_ids=["arithmetic_fluency"],
        min_age=8,
        max_age=12,
        icon="\U0001f9df",
        max_level=FactFluencyGame.metadata.max_level,
    )
