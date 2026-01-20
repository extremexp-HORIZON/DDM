import { useMemo } from "react";
import { weiToEth, countEventsByName } from "../../utils/web3DashboardUtils";

export function useDashboardDerived({
  suiteEvents = [],
  datasetEvents = [],
  validationEvents = [],
  catEvents = [],
  fmtEvents = [],
  valRegEvents = [],
  globalFilter = "",
  statusFilter = null,
  categoryFilter = null,
  fileFormatFilter = null,
}) {
  // ----------------------------
  // suites
  // ----------------------------
  const suites = useMemo(() => {
    const byId = new Map();

    for (const ev of suiteEvents) {
      const name = ev.name;
      const args = ev.args || {};
      const id = Number(args.id);
      if (!id || Number.isNaN(id)) continue;

      if (!byId.has(id)) {
        byId.set(id, {
          id,
          requester: args.requester || "",
          suiteHash: args.suiteHash || "",
          category: args.category || "",
          fileFormat: args.fileFormat || "",
          bountyWei: "0",
          bountyEth: 0,
          totalExpected: 0,
          totalClaims: 0,
          claimedEth: 0,
          remainingEth: 0,
          deadline: 0,
          isClosed: false,
          closedBy: null,
          refundWei: null,
          refundEth: null,
          suiteURI: "",
          docsURI: "",
          certificateURI: "",
        });
      }

      const row = byId.get(id);

      if (name === "DatasetRequestCreated") {
        const bountyWei = args.bounty?.toString() || "0";
        const bountyEth = weiToEth(bountyWei);

        row.requester = args.requester || row.requester;
        row.suiteHash = args.suiteHash || row.suiteHash;
        row.category = args.category || row.category;
        row.fileFormat = args.fileFormat || row.fileFormat;
        row.bountyWei = bountyWei;
        row.bountyEth = bountyEth;
        row.totalExpected = Number(args.expected || 0);
        row.deadline = Number(args.deadline || 0);
        row.suiteURI = args.suiteURI || row.suiteURI;
        row.docsURI = args.docsURI || row.docsURI;
        row.certificateURI = args.certificateURI || row.certificateURI;

        const claimedEth = row.claimedEth || 0;
        row.remainingEth = Math.max(bountyEth - claimedEth, 0);
      }

      if (name === "DatasetRewardClaimed") {
        const amountWei = args.amount?.toString() || "0";
        const amountEth = weiToEth(amountWei);
        row.totalClaims += 1;
        row.claimedEth = (row.claimedEth || 0) + amountEth;
        const bountyEth = row.bountyEth || 0;
        row.remainingEth = Math.max(bountyEth - row.claimedEth, 0);
      }

      if (name === "DatasetRequestClosed") {
        row.isClosed = true;
        row.closedBy = args.by || null;
        const refundWei = args.refund?.toString() || "0";
        row.refundWei = refundWei;
        row.refundEth = weiToEth(refundWei);
      }
    }

    return Array.from(byId.values()).sort((a, b) => a.id - b.id);
  }, [suiteEvents]);

  const requestIdBySuiteHash = useMemo(() => {
    const m = new Map(); // suiteHashLower -> requestId
    // pick the latest (highest id) non-closed request for each hash
    for (const s of suites) {
        const sh = (s.suiteHash || "").toLowerCase();
        if (!sh) continue;
        if (s.isClosed) continue;
        const prev = m.get(sh);
        if (!prev || s.id > prev) m.set(sh, s.id);
    }
    return m;
    }, [suites]);


  // ----------------------------
  // ✅ claimedByFp (MUST be top-level, not inside suites loop)
  // ----------------------------
  const claimedByFp = useMemo(() => {
    const m = new Map(); // fp -> { count, amountEthTotal }

    for (const ev of suiteEvents) {
      if (ev.name !== "DatasetRewardClaimed") continue;
      const args = ev.args || {};

      const fp =
        args.datasetFingerprint ||
        args.fingerprint ||
        args.datasetFp ||
        args.dataset ||
        null;

      if (!fp) continue;

      const amountWei = args.amount?.toString?.() || "0";
      const amountEth = weiToEth(amountWei);

      const key = String(fp);
      const prev = m.get(key) || { count: 0, amountEthTotal: 0 };
      m.set(key, {
        count: prev.count + 1,
        amountEthTotal: prev.amountEthTotal + amountEth,
      });
    }

    return m;
  }, [suiteEvents]);

  // ----------------------------
  // datasets + validations
  // ----------------------------
  const datasets = useMemo(() => {
    const map = new Map();

    for (const ev of datasetEvents) {
      if (ev.name !== "DatasetRegistered") continue;
      const args = ev.args || {};
      const fp = args.fingerprint || args.datasetFingerprint;
      if (!fp) continue;

      const key = String(fp);
      const claimInfo = claimedByFp.get(key);

      if (!map.has(key)) {
        map.set(key, {
          fingerprint: key,
          uploader: args.uploader || "",
          uri: args.uri || "",
          reportURI: args.reportURI || args.reportUri || "",
          suiteHash: args.suiteHash || "",
          fileFormat: args.fileFormat || "",
          registeredAt: Number(args.registeredAt || 0),

          // ✅ claim info
          claimed: !!claimInfo,
          claimedCount: claimInfo?.count || 0,
          claimedAmountEth: claimInfo?.amountEthTotal || 0,

          validations: 0,
          lastStatus: null,
          validators: new Set(),
          validationsArr: [],
          validationReportURIs: [],
        });
      } else {
        const row = map.get(key);
        row.uploader = args.uploader || row.uploader;
        row.uri = args.uri || row.uri;
        row.reportURI = args.reportURI || args.reportUri || row.reportURI || "";
        row.suiteHash = args.suiteHash || row.suiteHash;
        row.fileFormat = args.fileFormat || row.fileFormat;
        row.registeredAt = Number(args.registeredAt || row.registeredAt || 0);

        row.claimed = !!claimInfo;
        row.claimedCount = claimInfo?.count || 0;
        row.claimedAmountEth = claimInfo?.amountEthTotal || 0;
      }
    }

    for (const ev of validationEvents) {
      if (ev.name !== "ValidationSubmitted") continue;
      const args = ev.args || {};
      const fp = args.datasetFingerprint || args.fingerprint || args.dataset || null;
      if (!fp) continue;

      const key = String(fp);
      const claimInfo = claimedByFp.get(key);

      if (!map.has(key)) {
        map.set(key, {
          fingerprint: key,
          uploader: "",
          uri: "",
          reportURI: "",
          suiteHash: "",
          fileFormat: "",
          registeredAt: 0,

          // ✅ claim info (even if dataset registered not seen)
          claimed: !!claimInfo,
          claimedCount: claimInfo?.count || 0,
          claimedAmountEth: claimInfo?.amountEthTotal || 0,

          validations: 0,
          lastStatus: null,
          validators: new Set(),
          validationReportURIs: [],
          validationsArr: [],
        });
      }

      const row = map.get(key);
      row.validations += 1;

      const validator = args.validator || "";
      row.validators.add(validator);

      const successful = args.successful === true || args.successful === "true";
      const vReport = args.reportURI || args.reportUri || "";
      const vResult = args.resultURI || args.resultUri || "";

      if (vReport) row.validationReportURIs.push(vReport);

      row.validationsArr.push({
        validator,
        successful,
        reportURI: vReport,
        resultURI: vResult,
      });

      if (successful) row.lastStatus = "valid";
      else if (row.lastStatus !== "valid") row.lastStatus = "invalid";
    }

    const arr = Array.from(map.values()).map((row) => {
        const sh = (row.suiteHash || "").toLowerCase();
        const requestId = sh ? requestIdBySuiteHash.get(sh) : null;

        return {
            ...row,
            requestId: requestId ?? null,
            validatorsCount: row.validators.size,
        };
    });

    arr.sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0));
    return arr;
  }, [datasetEvents, validationEvents, claimedByFp, requestIdBySuiteHash]);

  // ----------------------------
  // allowed categories/formats, etc (unchanged)
  // ----------------------------
  const allowedCategories = useMemo(() => {
    const set = new Set();
    const ordered = [...catEvents].sort(
      (a, b) => a.block_number - b.block_number || a.log_index - b.log_index
    );
    for (const ev of ordered) {
      const args = ev.args || {};
      if (ev.name === "CategoryAdded" && args.category) set.add(args.category);
      if (ev.name === "CategoryRemoved" && args.category) set.delete(args.category);
    }
    return Array.from(set.values());
  }, [catEvents]);

  const allowedFormats = useMemo(() => {
    const set = new Set();
    const ordered = [...fmtEvents].sort(
      (a, b) => a.block_number - b.block_number || a.log_index - b.log_index
    );
    for (const ev of ordered) {
      const args = ev.args || {};
      if (ev.name === "FormatAdded" && args.format_) set.add(args.format_);
      if (ev.name === "FormatRemoved" && args.format_) set.delete(args.format_);
    }
    return Array.from(set.values());
  }, [fmtEvents]);

  const suiteHashToCategory = useMemo(() => {
    const m = new Map();
    suites.forEach((s) => {
      if (s.suiteHash) m.set(s.suiteHash.toLowerCase(), s.category);
    });
    return m;
  }, [suites]);

  const categoryOptions = useMemo(() => {
    const set = new Set();
    allowedCategories.forEach((c) => c && set.add(c));
    suites.forEach((s) => s.category && set.add(s.category));
    return [{ label: "All categories", value: null }, ...Array.from(set).sort().map((c) => ({ label: c, value: c }))];
  }, [allowedCategories, suites]);

  const fileFormatOptions = useMemo(() => {
    const set = new Set();
    allowedFormats.forEach((f) => f && set.add(f));
    suites.forEach((s) => s.fileFormat && set.add(s.fileFormat));
    datasets.forEach((d) => d.fileFormat && set.add(d.fileFormat));
    return [{ label: "All formats", value: null }, ...Array.from(set).sort().map((f) => ({ label: f, value: f }))];
  }, [allowedFormats, suites, datasets]);

  const categoryFilterValue =
    categoryFilter && typeof categoryFilter === "object" ? categoryFilter.value : categoryFilter;

  const fileFormatFilterValue =
    fileFormatFilter && typeof fileFormatFilter === "object" ? fileFormatFilter.value : fileFormatFilter;

  const activeValidators = useMemo(() => {
    const map = new Map();
    const ordered = [...valRegEvents].sort(
      (a, b) => a.block_number - b.block_number || a.log_index - b.log_index
    );

    for (const ev of ordered) {
      const args = ev.args || {};
      const addr = args.validator;
      if (!addr) continue;

      if (ev.name === "ValidatorAdded") {
        map.set(addr, {
          validator: addr,
          description: args.description || "",
          codeURI: args.codeURI || "",
          codeHash: args.codeHash || "",
          active: true,
        });
      }

      if (ev.name === "ValidatorUpdated") {
        const prev = map.get(addr) || {
          validator: addr,
          description: "",
          codeURI: "",
          codeHash: "",
          active: false,
        };
        map.set(addr, {
          validator: addr,
          description: args.description || prev.description,
          codeURI: args.codeURI || prev.codeURI,
          codeHash: args.codeHash || prev.codeHash,
          active: typeof args.active === "boolean" ? args.active : prev.active,
        });
      }

      if (ev.name === "ValidatorRemoved") map.delete(addr);
    }

    return Array.from(map.values());
  }, [valRegEvents]);

  const catEventCounts = useMemo(() => countEventsByName(catEvents), [catEvents]);
  const fmtEventCounts = useMemo(() => countEventsByName(fmtEvents), [fmtEvents]);
  const valRegEventCounts = useMemo(() => countEventsByName(valRegEvents), [valRegEvents]);
  const datasetEventCounts = useMemo(() => countEventsByName(datasetEvents), [datasetEvents]);
  const validationEventCounts = useMemo(() => countEventsByName(validationEvents), [validationEvents]);

  const filteredSuites = useMemo(() => {
    const nowMs = Date.now();

    return suites.filter((s) => {
      if (statusFilter === "open") {
        if (s.isClosed || (s.deadline && s.deadline * 1000 < nowMs)) return false;
      }
      if (statusFilter === "closed" && !s.isClosed) return false;
      if (statusFilter === "expired" && !(s.deadline && s.deadline * 1000 < nowMs && !s.isClosed)) return false;

      if (categoryFilterValue && s.category !== categoryFilterValue) return false;
      if (fileFormatFilterValue && s.fileFormat !== fileFormatFilterValue) return false;

      if (!globalFilter) return true;
      const g = globalFilter.toLowerCase();

      return (
        String(s.id).includes(g) ||
        (s.requester && s.requester.toLowerCase().includes(g)) ||
        (s.category && s.category.toLowerCase().includes(g)) ||
        (s.fileFormat && s.fileFormat.toLowerCase().includes(g)) ||
        (s.suiteURI && s.suiteURI.toLowerCase().includes(g))
      );
    });
  }, [suites, globalFilter, statusFilter, categoryFilterValue, fileFormatFilterValue]);

  const filteredDatasets = useMemo(() => {
    return datasets.filter((d) => {
      if (fileFormatFilterValue && d.fileFormat !== fileFormatFilterValue) return false;

      if (categoryFilterValue) {
        const cat = d.suiteHash && suiteHashToCategory.get(d.suiteHash.toLowerCase());
        if (cat !== categoryFilterValue) return false;
      }

      if (!globalFilter) return true;
      const g = globalFilter.toLowerCase();

      return (
        (d.fingerprint && d.fingerprint.toLowerCase().includes(g)) ||
        (d.uploader && d.uploader.toLowerCase().includes(g)) ||
        (d.fileFormat && d.fileFormat.toLowerCase().includes(g)) ||
        (d.uri && d.uri.toLowerCase().includes(g)) ||
        (d.suiteHash && d.suiteHash.toLowerCase().includes(g))
      );
    });
  }, [datasets, fileFormatFilterValue, categoryFilterValue, globalFilter, suiteHashToCategory]);

  const suitesWithDatasets = useMemo(() => {
    const bySuite = new Map();

    for (const d of datasets) {
      const sh = (d.suiteHash || "").toLowerCase();
      if (!sh) continue;
      if (!bySuite.has(sh)) bySuite.set(sh, []);

      bySuite.get(sh).push({
        fingerprint: d.fingerprint,
        uploader: d.uploader,
        reportURI: d.reportURI,
        validations: d.validationsArr || [], // ✅ keep real validations
        claimed: d.claimed,
        claimedCount: d.claimedCount,
        claimedAmountEth: d.claimedAmountEth,
      });
    }

    return filteredSuites.map((s) => {
      const list = bySuite.get((s.suiteHash || "").toLowerCase()) || [];
      const validationsCount = list.reduce((acc, x) => acc + (x.validations?.length || 0), 0);

      return {
        ...s,
        datasetsInfo: list,
        datasetsCount: list.length,
        validationsCount,
      };
    });
  }, [filteredSuites, datasets]);

  const suitesToRender = useMemo(() => suitesWithDatasets, [suitesWithDatasets]);
  const formatRegisteredAt = (ts) => (ts ? new Date(ts * 1000).toLocaleString() : "-");

  return {
    suites,
    datasets,
    allowedCategories,
    allowedFormats,
    categoryOptions,
    fileFormatOptions,
    activeValidators,
    catEventCounts,
    fmtEventCounts,
    valRegEventCounts,
    datasetEventCounts,
    validationEventCounts,
    filteredSuites,
    filteredDatasets,
    suitesToRender,
    formatRegisteredAt,
  };
}
