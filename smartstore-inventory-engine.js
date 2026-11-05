(function attachSmartstoreInventoryEngine(root, factory) {
  root.SmartstoreInventoryEngine = factory();
})(typeof globalThis !== "undefined" ? globalThis : window, function createSmartstoreInventoryEngine() {
  "use strict";

  function clean(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function productCode(product) {
    return clean(product?.상품코드 || product?.상품번호 || product?.바코드 || product?.productCode || product?.barcode);
  }

  function stockNumber(value) {
    const number = Number(clean(value).replace(/,/g, ""));
    return Number.isFinite(number) ? number : 0;
  }

  function validateReservation(input, product) {
    const code = clean(input?.productCode);
    const quantity = Number(input?.quantity);
    if (!product || !code || productCode(product) !== code) return { ok: false, error: "상품코드를 확인해주세요." };
    if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, error: "전용수량은 1 이상의 정수로 입력해주세요." };
    if (quantity > stockNumber(product?.현재고 ?? product?.stock)) return { ok: false, error: "전용수량은 현재고를 초과할 수 없습니다." };
    return { ok: true, reservation: { productCode: code, quantity } };
  }

  function getReservedQuantity(reservations, product) {
    const code = productCode(product);
    let quantity = 0;
    (reservations || []).forEach((reservation) => {
      if (clean(reservation?.productCode) === code) quantity = Math.max(0, Number(reservation?.quantity) || 0);
    });
    return quantity;
  }

  function summarizeAvailability(product, reservations) {
    const totalStock = stockNumber(product?.현재고 ?? product?.stock);
    const smartstoreReserved = getReservedQuantity(reservations, product);
    const regularAvailable = totalStock - smartstoreReserved;
    const status = regularAvailable <= 0
      ? (smartstoreReserved > 0 ? "smartstore-available" : "soldout")
      : "available";
    return { totalStock, regularAvailable, smartstoreReserved, status };
  }

  function parseReservationRows(rows, products) {
    const normalizedHeader = (value) => clean(value).replace(/\s+/g, "");
    const headerIndex = (rows || []).findIndex((row) => {
      const headers = (row || []).map(normalizedHeader);
      return headers.includes("바코드") && headers.includes("전용수량");
    });
    if (headerIndex < 0) return { ok: false, reservations: [], error: "바코드와 전용수량 머리글을 확인해주세요." };
    const headers = rows[headerIndex].map(normalizedHeader);
    const barcodeIndex = headers.indexOf("바코드");
    const quantityIndex = headers.indexOf("전용수량");
    const productMap = new Map((products || []).map((product) => [productCode(product), product]));
    const result = new Map();
    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const row = rows[index] || [];
      const code = clean(row[barcodeIndex]).replace(/\.0$/, "").replace(/\s+/g, "");
      const rawQuantity = clean(row[quantityIndex]);
      if (!code && !rawQuantity) continue;
      const product = productMap.get(code);
      const validation = validateReservation({ productCode: code, quantity: Number(rawQuantity.replace(/,/g, "")) }, product);
      if (!validation.ok) return { ok: false, reservations: [], error: `${index + 1}행: ${validation.error}` };
      result.set(code, validation.reservation);
    }
    if (!result.size) return { ok: false, reservations: [], error: "등록할 바코드와 전용수량이 없습니다." };
    return { ok: true, reservations: [...result.values()] };
  }

  return { productCode, validateReservation, getReservedQuantity, summarizeAvailability, parseReservationRows };
});
