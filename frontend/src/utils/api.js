// General API helper for fetch requests
export const fetchData = async (url, options = {}) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      let msg = 'Server error';
      try {
        const err = await res.json();
        msg = err.error || msg;
      } catch {}
      throw new Error(msg);
    }
    return await res.json();
  } catch (err) {
    throw err;
  }
};
