import EctoEnum

defenum(
  LCSchemas.Infra.AccountDeletionRequestStatus,
  :account_deletion_request_status,
  [:pending, :scheduled, :processing, :completed, :failed, :canceled]
)
