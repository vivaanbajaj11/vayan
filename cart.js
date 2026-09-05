// Simple cart stored in localStorage. Each line item: { id, name, price, image, qty }
const Cart = (() => {
  const STORAGE_KEY = 'tc_cart_v1';
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

  function addItem(product) {
    const items = read();
    const existing = items.find((i) => i.id === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        qty: 1,
      });
    }
    write(items);
  }

  function setQty(id, qty) {
    let items = read();
    if (qty <= 0) {
      items = items.filter((i) => i.id !== id);
    } else {
      const item = items.find((i) => i.id === id);
      if (item) item.qty = qty;
    }
    write(items);
  }

  function removeItem(id) {
    const items = read().filter((i) => i.id !== id);
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
