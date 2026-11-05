(function attachExpiryLotEngine(root, factory) {
  root.ExpiryLotEngine = factory();
})(typeof globalThis !== "undefined" ? globalThis : window, function createExpiryLotEngine() {
  "use strict";

  function clean(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function normalizeBarcode(value) {
    return clean(value).replace(/\.0$/, "").replace(/\s+/g, "");
  }

  function formatDate(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function parseDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return formatDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
    }
    const source = clean(value);
    const parts = source.match(/(?:^|\D)(20\d{2})[-./]?(\d{2})[-./]?(\d{2})(?:\D|$)/);
    if (!parts) return "";
    const year = Number(parts[1]);
    const month = Number(parts[2]);
    const day = Number(parts[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
    return formatDate(year, month, day);
  }

  function addDays(value, days) {
    const normalized = parseDate(value);
    if (!normalized) return "";
    const [year, month, day] = normalized.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  function shiftMonths(value, months) {
    const normalized = parseDate(value);
    if (!normalized) return "";
    const [year, month, day] = normalized.split("-").map(Number);
    const total = year * 12 + month - 1 + months;
    const targetYear = Math.floor(total / 12);
    const targetMonthIndex = ((total % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
    return formatDate(targetYear, targetMonthIndex + 1, Math.min(day, lastDay));
  }

  function expiryFromManufactured(value) {
    const shifted = shiftMonths(value, 18);
    return shifted ? addDays(shifted, -1) : "";
  }

  function manufacturedFromExpiry(value) {
    const nextDay = addDays(value, 1);
    return nextDay ? shiftMonths(nextDay, -18) : "";
  }

  function parseQuantity(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    const source = clean(value).replace(/,/g, "");
    if (!source) return NaN;
    const number = Number(source);
    return Number.isFinite(number) ? number : NaN;
  }

  function resolveDates(manufacturedValue, expiryValue) {
    const manufacturedDate = parseDate(manufacturedValue);
    const expiryDate = parseDate(expiryValue);
    if (clean(manufacturedValue) && !manufacturedDate) return { ok: false, error: "제조일자를 확인해주세요." };
    if (clean(expiryValue) && !expiryDate) return { ok: false, error: "유통기한을 확인해주세요." };
    if (manufacturedDate && expiryDate && expiryFromManufactured(manufacturedDate) !== expiryDate) {
      return { ok: false, error: "제조일자와 유통기한이 18개월-1일 규칙과 일치하지 않습니다." };
    }
    return {
      ok: true,
      manufacturedDate: manufacturedDate || manufacturedFromExpiry(expiryDate),
      expiryDate: expiryDate || expiryFromManufactured(manufacturedDate),
    };
  }

  function normalizeManualLot(input, options = {}) {
    const inboundDate = parseDate(input?.inboundDate);
    const barcode = normalizeBarcode(input?.barcode);
    const quantity = parseQuantity(input?.quantity);
    if (!inboundDate) return { ok: false, error: "입고일을 확인해주세요." };
    if (!barcode) return { ok: false, error: "바코드를 입력해주세요." };
    if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, error: "입고수량은 1 이상의 정수로 입력해주세요." };
    const dates = resolveDates(input?.manufacturedDate, input?.expiryDate);
    if (!dates.ok) return dates;
    const sequence = Number.isFinite(options.sequence) ? options.sequence : Date.now();
    return {
      ok: true,
      lot: {
        id: `manual:${sequence}:${barcode}`,
        sourceType: "manual",
        sourceFile: "",
        inboundDate,
        barcode,
        productName: clean(input?.productName),
        quantity,
        manufacturedDate: dates.manufacturedDate,
        expiryDate: dates.expiryDate,
        note: clean(input?.note),
        sequence,
      },
    };
  }

  function findHeaderIndex(rows) {
    return (rows || []).findIndex((row) => {
      const cells = (row || []).map((value) => clean(value).toLowerCase());
      return cells.includes("바코드") && cells.some((value) => value.includes("낱개") || value.includes("수량"));
    });
  }

  function buildHeaderMap(headerRow) {
    const map = {};
    (headerRow || []).forEach((value, index) => {
      const key = clean(value);
      if (!key) return;
      map[key] = index;
      map[key.toLowerCase()] = index;
    });
    return map;
  }

  function col(map, names) {
    for (const name of names) {
      if (map[name] != null) return map[name];
      if (map[name.toLowerCase()] != null) return map[name.toLowerCase()];
    }
    return -1;
  }

  function inboundDateFromFile(fileName, importedAt) {
    const prefix = clean(fileName).match(/^(20\d{6})/);
    return parseDate(prefix?.[1]) || parseDate(importedAt) || parseDate(new Date());
  }

  function parseContainerLots(rows, options = {}) {
    const headerIndex = findHeaderIndex(rows);
    if (headerIndex < 0) {
      return { ok: false, lots: [], expectedTotal: null, actualTotal: 0, error: "바코드·낱개수량(또는 수량) 머리글을 확인해주세요." };
    }
    const map = buildHeaderMap(rows[headerIndex]);
    const barcodeCol = col(map, ["바코드"]);
    const nameCol = col(map, ["상품명", "제품명", "품목명"]);
    const qtyCol = col(map, ["낱개수량", "수량", "입고수량"]);
    const mfgCol = col(map, ["제조일자", "제조일", "생산일"]);
    const expCol = col(map, ["유통기한", "소비기한", "유통기한일"]);
    const noteCol = col(map, ["비고", "메모"]);
    if (barcodeCol < 0 || qtyCol < 0) {
      return { ok: false, lots: [], expectedTotal: null, actualTotal: 0, error: "바코드와 낱개수량(수량) 열을 찾을 수 없습니다." };
    }

    const totalIndex = rows.findIndex((row, index) => index > headerIndex && (row || []).some((value) => clean(value) === "합계"));
    const endIndex = totalIndex >= 0 ? totalIndex : rows.length;
    const expectedTotal = totalIndex >= 0 ? parseQuantity(rows[totalIndex]?.[qtyCol]) : null;
    const fileName = clean(options.fileName);
    const inboundDate = parseDate(options.inboundDate) || inboundDateFromFile(fileName, options.importedAt);
    const defaultMfg = parseDate(options.defaultManufacturedDate) || "";
    const defaultExp = parseDate(options.defaultExpiryDate) || "";
    const candidates = [];
    let actualTotal = 0;
    for (let index = headerIndex + 1; index < endIndex; index += 1) {
      const row = rows[index] || [];
      const barcode = normalizeBarcode(row[barcodeCol]);
      const quantity = parseQuantity(row[qtyCol]);
      if (!barcode || barcode === "합계" || !Number.isFinite(quantity) || quantity <= 0) continue;
      let manufacturedDate = parseDate(row[mfgCol]) || defaultMfg;
      let expiryDate = parseDate(row[expCol]) || defaultExp;
      if (manufacturedDate && !expiryDate) expiryDate = expiryFromManufactured(manufacturedDate);
      if (expiryDate && !manufacturedDate) manufacturedDate = manufacturedFromExpiry(expiryDate);
      actualTotal += quantity;
      candidates.push({
        id: `${fileName}:${index}:${barcode}`,
        sourceType: "file",
        sourceFile: fileName,
        inboundDate,
        barcode,
        productName: nameCol >= 0 ? clean(row[nameCol]) : "",
        quantity,
        manufacturedDate: manufacturedDate || "",
        expiryDate: expiryDate || "",
        note: noteCol >= 0 ? clean(row[noteCol]) : "",
        sequence: index,
      });
    }
    if (!candidates.length) {
      return { ok: false, lots: [], expectedTotal, actualTotal, error: "유효한 품목 행이 없습니다." };
    }
    if (Number.isFinite(expectedTotal) && actualTotal !== expectedTotal) {
      return {
        ok: false,
        lots: [],
        expectedTotal,
        actualTotal,
        error: `상세 수량 합계(${actualTotal})와 합계행(${expectedTotal})이 일치하지 않습니다.`,
      };
    }
    const missingDates = candidates.filter((lot) => !lot.manufacturedDate && !lot.expiryDate).length;
    return { ok: true, lots: candidates, expectedTotal, actualTotal, missingDates };
  }

  function applyBatchDatesToLots(lots, manufacturedDate, expiryDate) {
    const mfg = parseDate(manufacturedDate) || "";
    let exp = parseDate(expiryDate) || "";
    if (mfg && !exp) exp = expiryFromManufactured(mfg);
    if (exp && !mfg) {
      const derivedMfg = manufacturedFromExpiry(exp);
      return (lots || []).map((lot) => ({
        ...lot,
        manufacturedDate: lot.manufacturedDate || derivedMfg,
        expiryDate: lot.expiryDate || exp,
      }));
    }
    return (lots || []).map((lot) => ({
      ...lot,
      manufacturedDate: lot.manufacturedDate || mfg,
      expiryDate: lot.expiryDate || (lot.manufacturedDate ? expiryFromManufactured(lot.manufacturedDate) : exp),
    }));
  }


  function replaceFileLots(existingLots, fileName, incomingLots) {
    const normalized = clean(fileName);
    return [...(existingLots || []).filter((lot) => !(lot?.sourceType === "file" && clean(lot?.sourceFile) === normalized)), ...(incomingLots || [])];
  }

  function consumptionOrder(left, right) {
    const leftHasExpiry = Boolean(clean(left.expiryDate));
    const rightHasExpiry = Boolean(clean(right.expiryDate));
    if (leftHasExpiry !== rightHasExpiry) return leftHasExpiry ? 1 : -1;
    return clean(left.expiryDate).localeCompare(clean(right.expiryDate))
      || clean(left.inboundDate).localeCompare(clean(right.inboundDate))
      || Number(left.sequence || 0) - Number(right.sequence || 0);
  }

  function allocateRemainingLots(lots, stockByBarcode = {}) {
    const groups = new Map();
    (lots || []).forEach((lot) => {
      const barcode = normalizeBarcode(lot?.barcode);
      if (!groups.has(barcode)) groups.set(barcode, []);
      groups.get(barcode).push({ ...lot, barcode });
    });
    const remaining = [];
    groups.forEach((items, barcode) => {
      const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
      let consumed = Math.max(0, total - Math.max(0, Number(stockByBarcode[barcode]) || 0));
      items.sort(consumptionOrder).forEach((item) => {
        const quantity = Math.max(0, Number(item.quantity) || 0);
        const used = Math.min(consumed, quantity);
        consumed -= used;
        if (quantity > used) remaining.push({ ...item, remainingQuantity: quantity - used });
      });
    });
    return remaining.sort(consumptionOrder);
  }

  function summarizeStockAllocation(lots, stockByBarcode = {}) {
    const remainingLots = allocateRemainingLots(lots, stockByBarcode);
    const assignedByBarcode = {};
    remainingLots.forEach((lot) => {
      const barcode = normalizeBarcode(lot?.barcode);
      assignedByBarcode[barcode] = (assignedByBarcode[barcode] || 0) + Math.max(0, Number(lot?.remainingQuantity) || 0);
    });
    const barcodes = new Set([
      ...Object.keys(stockByBarcode || {}).map(normalizeBarcode),
      ...(lots || []).map((lot) => normalizeBarcode(lot?.barcode)),
    ]);
    const byBarcode = {};
    barcodes.forEach((barcode) => {
      if (!barcode) return;
      const currentStock = Math.max(0, Number(stockByBarcode?.[barcode]) || 0);
      const expiryAssigned = Math.min(currentStock, assignedByBarcode[barcode] || 0);
      byBarcode[barcode] = {
        currentStock,
        expiryAssigned,
        expiryUnassigned: Math.max(0, currentStock - expiryAssigned),
      };
    });
    return { remainingLots, byBarcode };
  }

  return {
    normalizeBarcode,
    parseDate,
    expiryFromManufactured,
    manufacturedFromExpiry,
    resolveDates,
    normalizeManualLot,
    parseContainerLots,
    applyBatchDatesToLots,
    replaceFileLots,
    allocateRemainingLots,
    summarizeStockAllocation,
  };
});
