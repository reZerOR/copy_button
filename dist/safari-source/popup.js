const api = globalThis.BC_API;
const status = document.querySelector('#status');
async function message(data) {
  const result = await api.runtime.sendMessage(data);
  if (!result?.ok) throw new Error(result?.error || 'The extension could not complete this action');
  return result;
}
const store = await api.storage.local.get('captures');
document.querySelector('#count').textContent = (store.captures || []).length;
document.querySelector('#capture').addEventListener('click', async event => {
  event.currentTarget.disabled = true;
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    await message({ type: 'START_CAPTURE', tabId: tab.id }); window.close();
  } catch (error) { status.hidden = false; status.textContent = error.message; event.currentTarget.disabled = false; }
});
document.querySelector('#library').addEventListener('click', async () => {
  try { await message({ type: 'OPEN_LIBRARY' }); window.close(); }
  catch (error) { status.hidden = false; status.textContent = error.message; }
});
