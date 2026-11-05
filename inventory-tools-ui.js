(function initializeInventoryTools() {
  "use strict";

  workspace.expiryLots = Array.isArray(workspace.expiryLots) ? workspace.expiryLots : [];
  workspace.smartstoreReservations = Array.isArray(workspace.smartstoreReservations) ? workspace.smartstoreReservations : [];
  let cachedProducts = [];

  function safe(value) {
    return escapeHtml(value === null || value === undefined ? "" : String(value));
  }

  function quantity(value) {
    const number = Number(String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(number) ? number : 0;
  }

  async function products() {
    try {
      cachedProducts = await loadStockScheduleRows();
    } catch (_) {
      cachedProducts = cachedProducts.length ? cachedProducts : (workspace.containerInboundRecords || []);
    }
    return cachedProducts;
  }

  function findProduct(code, rows = cachedProducts) {
    const target = String(code || "").trim();
    return (rows || []).find((row) => window.SmartstoreInventoryEngine.productCode(row) === target) || null;
  }

  async function renderSmartstore() {
    const body = document.querySelector("#smartstore-body");
    if (!body) return;
    const rows = await products();
    const reservations = workspace.smartstoreReservations || [];
    document.querySelector("#smartstore-count").textContent = `${reservations.length}건`;
    body.innerHTML = reservations.length ? reservations.map((reservation) => {
      const product = findProduct(reservation.productCode, rows) || { 상품코드: reservation.productCode, 현재고: 0 };
      const availability = window.SmartstoreInventoryEngine.summarizeAvailability(product, reservations);
      const status = availability.status === "smartstore-available" ? "스마트스토어 출고가능" : "전용 재고 보유";
      return `<tr><td>${safe(reservation.productCode)}</td><td>${safe(product.상품명 || product.제품명 || "-")}</td><td>${availability.totalStock.toLocaleString("ko-KR")}</td><td>${availability.regularAvailable.toLocaleString("ko-KR")}</td><td><b>${availability.smartstoreReserved.toLocaleString("ko-KR")}</b></td><td><span class="tag blue">${status}</span></td><td><button type="button" class="secondary compact-button" data-smartstore-delete="${safe(reservation.productCode)}">삭제</button></td></tr>`;
    }).join("") : `<tr><td colspan="7">등록된 전용 재고가 없습니다.</td></tr>`;
  }

  async function renderExpiry() {
    const body = document.querySelector("#expiry-body");
    if (!body) return;
    if (!document.querySelector("#expiry-allocation-summary")) {
      body.closest(".panel")?.insertAdjacentHTML("beforebegin", `<section id="expiry-allocation-summary" class="panel product-detail-summary"><article><span>등록 품목 전체 현재고</span><b id="expiry-current-stock">0개</b></article><article><span>유통기한 지정 수량</span><b id="expiry-assigned-stock">0개</b></article><article><span>유통기한 미지정 수량</span><b id="expiry-unassigned-stock">0개</b></article><p class="form-help">업로드 수량은 현재고를 추가하지 않고, 기존 현재고 안에서 유통기한이 지정된 수량으로만 반영됩니다.</p></section>`);
    }
    const rows = await products();
    const stockByBarcode = {};
    const names = {};
    rows.forEach((row) => {
      const barcode = window.ExpiryLotEngine.normalizeBarcode(row.바코드 || row.상품코드);
      if (!barcode) return;
      stockByBarcode[barcode] = quantity(row.현재고);
      names[barcode] = row.상품명 || row.제품명 || "";
    });
    const allocation = window.ExpiryLotEngine.summarizeStockAllocation(workspace.expiryLots || [], stockByBarcode);
    const remaining = allocation.remainingLots;
    const registeredBarcodes = new Set((workspace.expiryLots || []).map((lot) => window.ExpiryLotEngine.normalizeBarcode(lot?.barcode)).filter(Boolean));
    const totals = [...registeredBarcodes].reduce((summary, barcode) => {
      const item = allocation.byBarcode[barcode] || { currentStock: 0, expiryAssigned: 0, expiryUnassigned: 0 };
      summary.currentStock += item.currentStock;
      summary.expiryAssigned += item.expiryAssigned;
      summary.expiryUnassigned += item.expiryUnassigned;
      return summary;
    }, { currentStock: 0, expiryAssigned: 0, expiryUnassigned: 0 });
    const currentStockNode = document.querySelector("#expiry-current-stock");
    const assignedNode = document.querySelector("#expiry-assigned-stock");
    const unassignedNode = document.querySelector("#expiry-unassigned-stock");
    if (currentStockNode) currentStockNode.textContent = `${totals.currentStock.toLocaleString("ko-KR")}개`;
    if (assignedNode) assignedNode.textContent = `${totals.expiryAssigned.toLocaleString("ko-KR")}개`;
    if (unassignedNode) unassignedNode.textContent = `${totals.expiryUnassigned.toLocaleString("ko-KR")}개`;
    document.querySelector("#expiry-count").textContent = `${remaining.length}건`;
    body.innerHTML = remaining.length ? remaining.map((lot) => {
      const inboundQty = Number(lot.quantity);
      const remainQty = Number(lot.remainingQuantity);
      return `<tr data-lot-id="${safe(lot.id)}"><td>${safe(lot.inboundDate)}</td><td>${safe(lot.barcode)}</td><td>${safe(lot.productName || names[lot.barcode] || "-")}</td><td><input type="number" class="expiry-lot-qty" data-lot-id="${safe(lot.id)}" data-field="quantity" min="0" step="1" value="${Number.isFinite(inboundQty) ? inboundQty : ""}" title="입고 수량" /><small class="expiry-remain-hint">잔여 ${Number.isFinite(remainQty) ? remainQty.toLocaleString("ko-KR") : "-"}</small></td><td><input type="date" class="expiry-lot-date" data-lot-id="${safe(lot.id)}" data-field="manufacturedDate" value="${safe(lot.manufacturedDate || "")}" title="제조일자" /></td><td><input type="date" class="expiry-lot-date" data-lot-id="${safe(lot.id)}" data-field="expiryDate" value="${safe(lot.expiryDate || "")}" title="유통기한" /></td><td>${safe(lot.note)}</td><td>${safe(lot.sourceFile)}</td><td><button type="button" class="secondary compact-button" data-expiry-delete="${safe(lot.id)}">삭제</button></td></tr>`;
    }).join("") : `<tr><td colspan="9">현재고에 남아 있는 등록 로트가 없습니다.</td></tr>`;
  }

  document.querySelector("#download-smartstore-template")?.addEventListener("click", () => {
    const sheet = XLSX.utils.aoa_to_sheet([["바코드", "전용수량"], ["8800000000000", 1]]);
    sheet["!cols"] = [{ wch: 18 }, { wch: 12 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "스마트스토어전용재고");
    XLSX.writeFile(workbook, "스마트스토어_전용재고_등록양식.xlsx");
  });

  document.querySelector("#smartstore-file")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const status = document.querySelector("#smartstore-file-status");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      const result = window.SmartstoreInventoryEngine.parseReservationRows(rows, await products());
      if (!result.ok) {
        alert(`${result.error}\n파일 전체를 반영하지 않았습니다.`);
        status.textContent = `${file.name} · 반영 실패`;
        return;
      }
      const merged = new Map((workspace.smartstoreReservations || []).map((item) => [item.productCode, item]));
      result.reservations.forEach((item) => merged.set(item.productCode, item));
      workspace.smartstoreReservations = [...merged.values()];
      saveWorkspace();
      status.textContent = `${file.name} · ${result.reservations.length}건 반영 완료`;
      showToast(`스마트스토어 전용 재고 ${result.reservations.length}건을 반영했습니다.`);
      await renderSmartstore();
    } catch (error) {
      alert(`파일을 읽지 못했습니다. 다시 첨부해주세요.\n${error.message}`);
      status.textContent = `${file.name} · 파일 읽기 실패`;
    } finally {
      event.target.value = "";
    }
  });

  document.querySelector("#smartstore-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const rows = await products();
    const productCode = document.querySelector("#smartstore-product-code").value.trim();
    const product = findProduct(productCode, rows);
    const result = window.SmartstoreInventoryEngine.validateReservation({
      productCode,
      quantity: Number(document.querySelector("#smartstore-quantity").value),
    }, product);
    if (!result.ok) return showToast(result.error);
    workspace.smartstoreReservations = (workspace.smartstoreReservations || []).filter((item) => item.productCode !== productCode);
    workspace.smartstoreReservations.push(result.reservation);
    saveWorkspace();
    event.currentTarget.reset();
    showToast("스마트스토어 전용 재고를 등록했습니다.");
    await renderSmartstore();
  });

  document.querySelector("#smartstore-body")?.addEventListener("click", async (event) => {
    const code = event.target.closest("[data-smartstore-delete]")?.dataset.smartstoreDelete;
    if (!code) return;
    workspace.smartstoreReservations = (workspace.smartstoreReservations || []).filter((item) => item.productCode !== code);
    saveWorkspace();
    await renderSmartstore();
  });

  const manufacturedInput = document.querySelector("#expiry-manufactured-date");
  const expiryInput = document.querySelector("#expiry-date");
  manufacturedInput?.addEventListener("change", () => {
    if (manufacturedInput.value && !expiryInput.value) expiryInput.value = window.ExpiryLotEngine.expiryFromManufactured(manufacturedInput.value);
  });
  expiryInput?.addEventListener("change", () => {
    if (expiryInput.value && !manufacturedInput.value) manufacturedInput.value = window.ExpiryLotEngine.manufacturedFromExpiry(expiryInput.value);
  });

  document.querySelector("#expiry-manual-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = window.ExpiryLotEngine.normalizeManualLot({
      inboundDate: document.querySelector("#expiry-inbound-date").value,
      barcode: document.querySelector("#expiry-barcode").value,
      quantity: Number(document.querySelector("#expiry-quantity").value),
      manufacturedDate: manufacturedInput.value,
      expiryDate: expiryInput.value,
      note: document.querySelector("#expiry-note").value,
    }, { sequence: Date.now() });
    if (!result.ok) return showToast(result.error);
    const row = findProduct(result.lot.barcode);
    result.lot.productName = row?.상품명 || row?.제품명 || "";
    workspace.expiryLots.push(result.lot);
    saveWorkspace();
    event.currentTarget.reset();
    showToast("유통기한 입고 로트를 등록했습니다.");
    await renderExpiry();
  });

  function openExpiryBatchDateModal(lots, meta) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:90;display:flex;align-items:center;justify-content:center;padding:16px";
      const missing = (lots || []).filter((l) => !l.manufacturedDate && !l.expiryDate).length;
      overlay.innerHTML = `
        <div style="background:#fff;border-radius:12px;width:min(440px,100%);padding:20px;box-shadow:0 16px 40px rgba(0,0,0,.18)">
          <h3 style="margin:0 0 8px;font-size:18px">제조일·유통기한 일괄 반영</h3>
          <p style="margin:0 0 14px;font-size:13px;color:#64748b;line-height:1.5">
            <b>${meta.fileName || "파일"}</b> · ${lots.length}개 품목 · 합계 ${(meta.actualTotal || 0).toLocaleString("ko-KR")}개<br>
            ${missing ? `날짜 없는 품목 <b style="color:#c75600">${missing}건</b> — 아래에 넣으면 전체(또는 비어 있는 행)에 반영됩니다.` : "파일에 날짜가 있습니다. 필요 시 일괄 덮어쓸 수 있습니다."}<br>
            제조일만 넣으면 <b>18개월-1일</b> 규칙으로 유통기한을 자동 계산합니다.
          </p>
          <label style="display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:10px">제조일자
            <input type="date" id="batch-mfg" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid #e5e7eb;border-radius:8px" />
          </label>
          <label style="display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:10px">유통기한 (선택)
            <input type="date" id="batch-exp" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid #e5e7eb;border-radius:8px" />
          </label>
          <label style="display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:14px">입고일 (선택)
            <input type="date" id="batch-inbound" value="${new Date().toISOString().slice(0,10)}" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid #e5e7eb;border-radius:8px" />
          </label>
          <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
            <button type="button" class="secondary" data-act="skip">날짜 없이 등록</button>
            <button type="button" class="secondary" data-act="cancel">취소</button>
            <button type="button" class="primary" data-act="apply">반영 후 등록</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const mfg = overlay.querySelector("#batch-mfg");
      const exp = overlay.querySelector("#batch-exp");
      mfg.addEventListener("change", () => {
        if (mfg.value && !exp.value && window.ExpiryLotEngine?.expiryFromManufactured) {
          exp.value = window.ExpiryLotEngine.expiryFromManufactured(mfg.value);
        }
      });
      exp.addEventListener("change", () => {
        if (exp.value && !mfg.value && window.ExpiryLotEngine?.manufacturedFromExpiry) {
          mfg.value = window.ExpiryLotEngine.manufacturedFromExpiry(exp.value);
        }
      });
      overlay.addEventListener("click", (e) => {
        const act = e.target?.dataset?.act;
        if (!act && e.target !== overlay) return;
        if (act === "cancel" || e.target === overlay) {
          overlay.remove();
          resolve(null);
          return;
        }
        if (act === "skip") {
          overlay.remove();
          resolve({ lots, skipped: true });
          return;
        }
        if (act === "apply") {
          let next = window.ExpiryLotEngine.applyBatchDatesToLots(lots, mfg.value, exp.value);
          const inbound = overlay.querySelector("#batch-inbound")?.value;
          if (inbound) next = next.map((l) => ({ ...l, inboundDate: inbound }));
          overlay.remove();
          resolve({ lots: next, skipped: false });
        }
      });
    });
  }

  document.querySelector("#expiry-file")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    document.querySelector("#expiry-file-name").textContent = file?.name || "파일을 선택하세요";
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      const result = window.ExpiryLotEngine.parseContainerLots(rows, { fileName: file.name, importedAt: new Date() });
      if (!result.ok) {
        alert(result.error);
        event.target.value = "";
        document.querySelector("#expiry-file-name").textContent = "파일을 다시 선택해주세요";
        return;
      }
      const decided = await openExpiryBatchDateModal(result.lots, {
        fileName: file.name,
        actualTotal: result.actualTotal,
      });
      if (!decided) {
        event.target.value = "";
        document.querySelector("#expiry-file-name").textContent = "파일을 선택하세요";
        return;
      }
      workspace.expiryLots = window.ExpiryLotEngine.replaceFileLots(workspace.expiryLots || [], file.name, decided.lots);
      saveWorkspace();
      showToast(`${decided.lots.length}개 로트를 반영했습니다. 합계 ${result.actualTotal.toLocaleString("ko-KR")}개`);
      await renderExpiry();
    } catch (error) {
      alert(`파일을 읽지 못했습니다. 다시 첨부해주세요.\n${error.message}`);
    }
  });

  document.querySelector("#expiry-body")?.addEventListener("click", async (event) => {
    const id = event.target.closest("[data-expiry-delete]")?.dataset.expiryDelete;
    if (!id) return;
    workspace.expiryLots = (workspace.expiryLots || []).filter((lot) => lot.id !== id);
    saveWorkspace();
    await renderExpiry();
  });

  document.querySelector("#expiry-body")?.addEventListener("change", async (event) => {
    const input = event.target.closest(".expiry-lot-date, .expiry-lot-qty");
    if (!input) return;
    const lotId = input.dataset.lotId;
    const field = input.dataset.field;
    const lots = workspace.expiryLots || [];
    const idx = lots.findIndex((lot) => String(lot.id) === String(lotId));
    if (idx < 0) return;
    const next = { ...lots[idx] };
    if (field === "quantity") {
      const qty = Number(String(input.value || "").replace(/,/g, ""));
      if (!Number.isFinite(qty) || qty < 0) {
        showToast("입고 수량을 확인해주세요.");
        return;
      }
      next.quantity = qty;
    } else {
      const value = input.value || "";
      next[field] = value;
      if (field === "manufacturedDate" && value && window.ExpiryLotEngine?.expiryFromManufactured) {
        next.expiryDate = window.ExpiryLotEngine.expiryFromManufactured(value);
      }
      if (field === "expiryDate" && value && !next.manufacturedDate && window.ExpiryLotEngine?.manufacturedFromExpiry) {
        next.manufacturedDate = window.ExpiryLotEngine.manufacturedFromExpiry(value);
      }
      if (value && next.manufacturedDate && next.expiryDate) {
        const check = window.ExpiryLotEngine.resolveDates?.(next.manufacturedDate, next.expiryDate);
        if (check && check.ok === false) {
          showToast(check.error);
          return;
        }
      }
    }
    lots[idx] = next;
    workspace.expiryLots = lots;
    saveWorkspace();
    showToast(field === "quantity" ? "입고 수량을 저장했습니다." : "로트 날짜를 저장했습니다.");
    await renderExpiry();
  });

  document.querySelectorAll('[data-page="smartstore"]').forEach((button) => button.addEventListener("click", renderSmartstore));
  document.querySelectorAll('[data-page="expiry"]').forEach((button) => button.addEventListener("click", renderExpiry));
  document.querySelector("#expiry-inbound-date").value = new Date().toISOString().slice(0, 10);
})();
