// Treat a resolved API response carrying `success: false` as a failed request
// so a react-query `mutationFn` rejects instead of running its `onSuccess`.
export function throwIfApiFailed(data, fallbackMessage = 'Request failed') {
  if (data && data.success === false) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}
