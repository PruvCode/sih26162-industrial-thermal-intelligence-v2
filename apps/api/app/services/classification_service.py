import json
import random
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classification import Classification

# Reported on every classification so a bad prediction can be traced back to
# the model that produced it. Bump this when the real model replaces the
# placeholder below.
MODEL_VERSION = "mock-v0.2"

# These four values are a contract, not a preference.
#
# The frontend's ThermalClass union (src/types/event.ts) is exactly this set,
# and mapClassLabel() in mappers.ts returns `undefined` for anything outside
# it — so a label like "wildfire" or "gas_flare" would reach the UI and render
# as *no classification at all*, with no error anywhere. Adding a class means
# changing both sides together.
LABELS = [
    "industrial_fire",
    "persistent_thermal_source",
    "natural_wildfire",
    "other",
]

# Rough prior probabilities. Used only by the placeholder model.
LABEL_WEIGHTS = [0.45, 0.25, 0.20, 0.10]

FEATURE_NAMES = [
    "frp_mean",
    "frp_std",
    "brightness_delta",
    "spatial_extent_km",
    "duration_hours",
    "proximity_to_industrial",
    "night_ratio",
    "spectral_index",
]


def _mock_classify(seed: str) -> tuple[str, float, str, list[str]]:
    """
    Deterministic stand-in for the real model.

    Seeded from the event id so the same event always produces the same
    answer. The previous version used the global ``random`` module, which meant
    two identical requests could disagree, a result could not be reproduced
    from a bug report, and nothing could be asserted in a test.

    **This function is the entire ML integration boundary.** Replacing its body
    with an HTTP call to the real model service (``settings.ML_SERVICE_URL``)
    is the whole of "wiring up the ML": keep the signature and the returned
    vocabulary, and nothing downstream changes — not the schema, not the
    endpoints, not the frontend.
    """
    rng = random.Random(seed)
    label = rng.choices(LABELS, weights=LABEL_WEIGHTS, k=1)[0]
    confidence = round(rng.uniform(0.60, 0.98), 4)
    explanation = (
        f"The thermal signature with FRP and brightness patterns most closely "
        f"resembles a {label.replace('_', ' ')} event. "
        f"Proximity to industrial infrastructure and temporal characteristics "
        f"were weighted factors in this classification."
    )
    features_used = rng.sample(FEATURE_NAMES, k=rng.randint(3, 6))
    return label, confidence, explanation, features_used


async def get_classifications_for_event(
    db: AsyncSession, event_id: uuid.UUID
) -> list[Classification]:
    result = await db.execute(
        select(Classification)
        .where(Classification.event_id == event_id)
        .order_by(Classification.confidence.desc())
    )
    return list(result.scalars().all())


async def classify_event(
    db: AsyncSession, event_id: uuid.UUID, *, force: bool = False
) -> tuple[Classification, bool]:
    """
    Classify an event, returning ``(classification, created)``.

    By default an event is classified at most once; later calls return the
    existing row. ``force=True`` always writes a new row, because keeping the
    history is useful and re-running after a model upgrade is a normal
    operation rather than an error.
    """
    if not force:
        existing = await get_classifications_for_event(db, event_id)
        if existing:
            return existing[0], False

    label, confidence, explanation, features_used = _mock_classify(str(event_id))

    classification = Classification(
        event_id=event_id,
        label=label,
        confidence=confidence,
        model_version=MODEL_VERSION,
        explanation=explanation,
        # JSON, not str(list): the column is a string but Python's list repr
        # is not readable by anything else on the stack.
        features_used=json.dumps(features_used),
        evidence_summary=(
            f"Based on {len(features_used)} features, classified as {label}"
        ),
        classified_at=datetime.now(UTC),
    )
    db.add(classification)
    await db.flush()
    await db.refresh(classification)
    return classification, True


async def seed_mock_classifications(
    db: AsyncSession, event_ids: list[uuid.UUID]
) -> int:
    count = 0
    for eid in event_ids:
        result = await db.execute(
            select(Classification).where(Classification.event_id == eid)
        )
        if result.scalar_one_or_none() is None:
            await classify_event(db, eid)
            count += 1
    return count
