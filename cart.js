// Simple cart stored in localStorage. Each line item: { lineId, id, name, price, image, size, qty }
// lineId combines product id + size, so the same shirt in two different sizes
// shows up as two separate lines in the cart.
const Cart = (() => {
  const STORAGE_KEY = 'tc_cart_v2';
  let listeners = [];

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Cart read error', e);
      return [];
    }
  }

  function write(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Cart write error', e);
    }
    listeners.forEach((fn) => fn(items));
  }

  function addItem(product, size) {
    const items = read();
    const lineId = `${product.id}::${size || 'onesize'}`;
    const existing = items.find((i) => i.lineId === lineId);
    if (existing) {
      existing.qty += 1;
    } else {
      const thumb = (product.images && product.images[0] && product.images[0].url) || product.image || '';
      items.push({
        lineId,
        id: product.id,
        name: product.name,
        price: product.price,
        image: thumb,
        size: size || null,
        qty: 1,
      });
    }
    write(items);
  }

  function setQty(lineId, qty) {
    let items = read();
    if (qty <= 0) {
      items = items.filter((i) => i.lineId !== lineId);
    } else {
      const item = items.find((i) => i.lineId === lineId);
      if (item) item.qty = qty;
    }
    write(items);
  }

  function removeItem(lineId) {
    const items = read().filter((i) => i.lineId !== lineId);
    write(items);
  }

  function getItems() {
    return read();
  }

  function getTotal() {
    return read().reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  function getCount() {
    return read().reduce((sum, i) => sum + i.qty, 0);
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  return { addItem, setQty, removeItem, getItems, getTotal, getCount, onChange };
})();
