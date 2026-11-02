from typing import TypedDict


# Preserve the API's existing JSON keys, including the Python keyword `from`.
FieldChange = TypedDict('FieldChange', {'from': str | None, 'to': str | None})
AuditChanges = dict[str, FieldChange]
