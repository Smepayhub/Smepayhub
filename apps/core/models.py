import uuid
from django.db import models

class TimeStampedModel(models.Model):
    """Abstract base model with auto-managed creation and update timestamps."""
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ['-created_at']

class UUIDModel(models.Model):
    """Abstract base model using cryptographic UUID primary keys."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True

class BaseModel(UUIDModel, TimeStampedModel):
    """Combined base model providing UUID primary key and timestamp tracking."""
    class Meta:
        abstract = True
        ordering = ['-created_at']
