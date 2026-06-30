// Map a failed thread-deletion error to a user-facing message.
export function isThreadBusyError(error) {
  return error?.status === 409 && error?.payload?.kind === 'busy';
}

export function deleteThreadErrorMessage(error, t) {
  if (isThreadBusyError(error)) return t('chat.deleteBusy');
  return error?.message || t('chat.deleteFailed');
}
