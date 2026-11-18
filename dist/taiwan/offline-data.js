export function readSavedData(name) {
  try {
    return JSON.parse(localStorage.getItem(`taiwan-offline-${name}`));
  } catch {
    return null;
  }
}

export function saveData(name, value) {
  try {
    localStorage.setItem(`taiwan-offline-${name}`, JSON.stringify(value));
  } catch {
    // The tool still works when local storage is unavailable.
  }
}
