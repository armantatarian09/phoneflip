import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bookmark,
  Calculator,
  CheckCircle2,
  Database,
  ExternalLink,
  FileUp,
  Gauge,
  Info,
  ListFilter,
  ClipboardList,
  Radar,
  RotateCcw,
  Save,
  ScanSearch,
  Search,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Store,
  Trash2,
  TrendingUp,
  Workflow,
  Zap
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { conditionOptions, marketplaceNames, phoneBrands } from "./data/referenceData.js";
import {
  clearImportedDeals,
  getBlocketImportEstimateUrl,
  getBlocketImportStartUrl,
  getBlocketImportStatusUrl,
  getImportTemplate,
  importMarketplaceDeals,
  loadMarketplaceDeals,
  marketplaceAdapters
} from "./services/marketplaceAdapters.js";
import {
  damageTypes,
  iphoneGenerations,
  iphoneVariants,
  storageOptions
} from "./services/pricing.js";
import {
  calculateActualProfit,
  createLedgerItem,
  createWatchItem,
  loadLedger,
  loadSettings,
  loadWatchlist,
  numberOrZero,
  pipelineStatuses,
  resetSettings,
  saveLedger,
  saveSettings,
  saveWatchlist
} from "./services/storage.js";

const currency = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  maximumFractionDigits: 0
});

const defaultFilters = {
  marketplace: "Alla",
  brand: "Alla",
  model: "",
  minPrice: "",
  maxPrice: "2500",
  condition: "Alla",
  buyNow: "Alla",
  location: "",
  ageHours: "Alla",
  profitPotential: "Alla",
  riskLevel: "Alla",
  minConfidence: "Alla",
  maxRepair: "",
  sortBy: "flipScore",
  excludeLocked: false,
  excludeWater: false,
  excludeMotherboard: false
};

const apiImportLimits = {
  min: 10,
  max: 1000,
  step: 10,
  defaultValue: 60
};

const conditionAliases = {
  Trasig: ["trasig", "trasiga", "broken", "fungerar ej", "fungerar inte"],
  Defekt: ["defekt", "defekta", "defective", "not working", "moderkort", "baseband", "ingen service", "kretskort"],
  Skadad: ["skadad", "skadade", "damaged", "skada", "krossad", "krossat"],
  "Sprucken skärm": ["sprucken skärm", "skärmen sprucken", "screen", "cracked", "skärmproblem", "spricka", "sprickor", "krossad skärm", "glas", "frontglas"],
  "Laddar inte": ["laddar inte", "tar inte laddning", "laddport", "laddproblem", "laddkontakt", "ladduttag", "not charging", "charge port"],
  Batteriproblem: ["batteri", "battery", "batterihälsa", "dåligt batteri", "service batteri"],
  "Baksida sprucken": ["baksida", "bakglas", "back glass", "back cracked"],
  Displayproblem: ["display", "displayproblem", "touch", "ghost touch", "svart skärm", "grön skärm", "linjer", "pixlar"],
  Vattenskadad: ["vattenskad", "water damage", "water"],
  "iCloud låst": ["icloud", "icloudlåst", "låst", "locked", "activation lock", "aktiveringslås", "kodlåst", "lösenkod", "glömt kod", "avaktiverad", "simlåst", "operatörslåst"],
  "Face ID defekt": ["face id"],
  "Startar inte": ["startar inte", "går inte igång", "does not turn on", "no power", "död", "bootloop", "fastnar på logga", "äppellogo", "recovery", "dfu"],
  Reservdelar: ["reservdel", "reservdelar", "parts"],
  "Endast delar": ["endast delar", "parts only"],
  Reparationsobjekt: ["reparationsobjekt", "repair object", "rep objekt"]
};

const processSteps = [
  {
    icon: Search,
    title: "Sök på marknadsplatser",
    text: "Samla annonser från Tradera, Blocket och Vinted via godkända integrationer."
  },
  {
    icon: ScanSearch,
    title: "Identifiera nyckelord",
    text: "Hitta ord som trasig, defekt, sprucken skärm, locked och parts only."
  },
  {
    icon: Calculator,
    title: "Uppskatta reparation",
    text: "Matcha skadetyp mot rimliga kostnader för skärm, batteri, laddport och bakglas."
  },
  {
    icon: BarChart3,
    title: "Jämför andrahandsvärde",
    text: "Värdera modellen i fungerande skick och ta hänsyn till efterfrågan."
  },
  {
    icon: TrendingUp,
    title: "Räkna ut vinst",
    text: "Beräkna potentiell marginal efter inköp och uppskattad reparation."
  },
  {
    icon: Gauge,
    title: "Sortera bästa först",
    text: "Visa annonser med stark Flip Score och tydliga riskflaggor."
  }
];

function App() {
  const [activeView, setActiveView] = useState("home");
  const [pricingSettings, setPricingSettings] = useState(() => loadSettings());
  const [deals, setDeals] = useState([]);
  const [dataStatus, setDataStatus] = useState({
    label: "Väntar på import",
    message: "Importera CSV eller JSON för att fylla dashboarden."
  });
  const [filters, setFilters] = useState(defaultFilters);
  const [watchlist, setWatchlist] = useState(() => loadWatchlist());
  const [ledger, setLedger] = useState(() => loadLedger());

  useEffect(() => {
    let isMounted = true;

    loadMarketplaceDeals(pricingSettings)
      .then((result) => {
        if (!isMounted) return;
        setDeals(result.deals);
        setDataStatus({
          label: result.label,
          message: result.message
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        setDataStatus({
          label: "Importfel",
          message: error.message
        });
      });

    return () => {
      isMounted = false;
    };
  }, [pricingSettings]);

  useEffect(() => {
    saveSettings(pricingSettings);
  }, [pricingSettings]);

  useEffect(() => {
    saveWatchlist(watchlist);
  }, [watchlist]);

  useEffect(() => {
    saveLedger(ledger);
  }, [ledger]);

  const savedIds = useMemo(() => watchlist.map((item) => item.dealId), [watchlist]);

  const filteredDeals = useMemo(() => {
    const matchingDeals = deals.filter((deal) => {
      const matchesMarketplace =
        filters.marketplace === "Alla" || deal.marketplace === filters.marketplace;
      const matchesBrand = filters.brand === "Alla" || deal.brand === filters.brand;
      const matchesModel =
        !filters.model ||
        deal.model.toLocaleLowerCase("sv-SE").includes(
          filters.model.toLocaleLowerCase("sv-SE")
        );
      const minPrice = Number(filters.minPrice);
      const maxPrice = Number(filters.maxPrice);
      const matchesMinPrice =
        !filters.minPrice || (Number.isFinite(minPrice) && deal.askingPrice >= minPrice);
      const matchesMaxPrice =
        !filters.maxPrice || (Number.isFinite(maxPrice) && deal.askingPrice <= maxPrice);
      const matchesCondition =
        filters.condition === "Alla" || matchesConditionFilter(deal, filters.condition);
      const matchesBuyNow =
        filters.buyNow === "Alla" ||
        (filters.buyNow === "Endast Köp nu" ? deal.hasBuyNow : !deal.hasBuyNow);
      const matchesLocation =
        !filters.location ||
        deal.location
          .toLocaleLowerCase("sv-SE")
          .includes(filters.location.toLocaleLowerCase("sv-SE"));
      const matchesAge =
        filters.ageHours === "Alla" || deal.ageHours <= Number(filters.ageHours);
      const matchesProfit =
        filters.profitPotential === "Alla" ||
        deal.estimatedProfit >= Number(filters.profitPotential);
      const matchesRisk =
        filters.riskLevel === "Alla" || deal.riskLevel === filters.riskLevel;
      const matchesConfidence =
        filters.minConfidence === "Alla" ||
        deal.confidenceScore >= Number(filters.minConfidence);
      const matchesRepair =
        !filters.maxRepair || deal.repairEstimate <= Number(filters.maxRepair);
      const allowedLocked =
        !filters.excludeLocked || !deal.damageTypes?.includes("locked");
      const allowedWater =
        !filters.excludeWater || !deal.damageTypes?.includes("water");
      const allowedMotherboard =
        !filters.excludeMotherboard || !deal.damageTypes?.includes("motherboard");

      return (
        matchesMarketplace &&
        matchesBrand &&
        matchesModel &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesCondition &&
        matchesBuyNow &&
        matchesLocation &&
        matchesAge &&
        matchesProfit &&
        matchesRisk &&
        matchesConfidence &&
        matchesRepair &&
        allowedLocked &&
        allowedWater &&
        allowedMotherboard
      );
    });
    return sortDealsByPreference(matchingDeals, filters.sortBy);
  }, [deals, filters]);

  const savedDeals = useMemo(
    () => deals.filter((deal) => savedIds.includes(deal.id)),
    [deals, savedIds]
  );

  const enrichedWatchlist = useMemo(() => {
    const dealMap = new Map(deals.map((deal) => [deal.id, deal]));
    return watchlist.map((item) => ({
      ...item,
      deal: dealMap.get(item.dealId)
    }));
  }, [deals, watchlist]);

  const ledgerRows = useMemo(() => {
    const dealMap = new Map(deals.map((deal) => [deal.id, deal]));
    return ledger.map((item) => ({
      ...item,
      deal: dealMap.get(item.dealId),
      actualProfit: calculateActualProfit(item)
    }));
  }, [deals, ledger]);

  const filterOptions = useMemo(() => {
    return {
      marketplaces: mergeOptions(marketplaceNames, deals.map((deal) => deal.marketplace)),
      brands: mergeOptions(phoneBrands, deals.map((deal) => deal.brand)),
      conditions: mergeOptions(conditionOptions, deals.map((deal) => deal.condition))
    };
  }, [deals]);

  const dashboardStats = useMemo(() => {
    const bestDeal = filteredDeals[0];
    const avgProfit =
      filteredDeals.reduce((sum, deal) => sum + deal.estimatedProfit, 0) /
      Math.max(filteredDeals.length, 1);
    const cheapDamagedCount = filteredDeals.filter(
      (deal) => deal.askingPrice <= 1500 && hasDamageSignal(deal)
    ).length;
    const avgConfidence =
      filteredDeals.reduce((sum, deal) => sum + (deal.confidenceScore ?? 0), 0) /
      Math.max(filteredDeals.length, 1);

    return {
      count: filteredDeals.length,
      bestScore: bestDeal?.flipScore ?? 0,
      avgProfit: Math.round(avgProfit),
      cheapDamagedCount,
      avgConfidence: Math.round(avgConfidence)
    };
  }, [filteredDeals]);

  const importTemplate = useMemo(() => getImportTemplate(), []);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function importDeals(input, sourceName) {
    const result = importMarketplaceDeals(input, sourceName, pricingSettings);
    setDeals(result.deals);
    setDataStatus({
      label: result.label,
      message: result.message
    });
    setFilters(defaultFilters);
    return result;
  }

  function clearDeals() {
    clearImportedDeals();
    setDeals([]);
    setWatchlist([]);
    setLedger([]);
    setDataStatus({
      label: "Väntar på import",
      message: "Importerad data är rensad."
    });
    setFilters(defaultFilters);
  }

  function toggleSaved(deal) {
    setWatchlist((current) => {
      if (current.some((item) => item.dealId === deal.id)) {
        return current.filter((item) => item.dealId !== deal.id);
      }
      const watchItem = createWatchItem(deal);
      setLedger((rows) =>
        rows.some((row) => row.dealId === deal.id)
          ? rows
          : [...rows, createLedgerItem(deal, watchItem)]
      );
      return [...current, watchItem];
    });
  }

  function updateWatchItem(dealId, updates) {
    setWatchlist((current) =>
      current.map((item) =>
        item.dealId === dealId
          ? { ...item, ...updates, updatedAt: new Date().toISOString() }
          : item
      )
    );
    setLedger((rows) =>
      rows.map((row) =>
        row.dealId === dealId
          ? {
              ...row,
              status: updates.status ?? row.status,
              buyPrice: updates.agreedBuyPrice ?? row.buyPrice,
              repairCost: updates.partsCost ?? row.repairCost,
              otherCosts: updates.otherCosts ?? row.otherCosts,
              salePrice: updates.salePrice ?? row.salePrice,
              fees: updates.fees ?? row.fees,
              boughtAt: updates.boughtAt ?? row.boughtAt,
              soldAt: updates.soldAt ?? row.soldAt,
              notes: updates.notes ?? row.notes,
              updatedAt: new Date().toISOString()
            }
          : row
      )
    );
  }

  function updateLedgerItem(id, updates) {
    setLedger((rows) =>
      rows.map((row) =>
        row.id === id ? { ...row, ...updates, updatedAt: new Date().toISOString() } : row
      )
    );
  }

  function updatePricingSettings(updater) {
    setPricingSettings((current) =>
      typeof updater === "function" ? updater(current) : updater
    );
  }

  function restoreDefaultSettings() {
    setPricingSettings(resetSettings());
  }

  function goTo(view) {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <Header
        activeView={activeView}
        goTo={goTo}
        savedCount={savedDeals.length}
        ledgerCount={ledger.length}
      />

      <main>
        {activeView === "home" && (
          <>
            <Hero goTo={goTo} topDeals={filteredDeals.slice(0, 3)} />
            <Dashboard
              deals={filteredDeals}
              totalDeals={deals.length}
              filters={filters}
              filterOptions={filterOptions}
              updateFilter={updateFilter}
              resetFilters={() => setFilters(defaultFilters)}
              savedIds={savedIds}
              toggleSaved={toggleSaved}
              stats={dashboardStats}
              dataStatus={dataStatus}
              importTemplate={importTemplate}
              onImport={importDeals}
              onClearDeals={clearDeals}
            />
            <RiskWarning />
            <HowItWorks />
            <IntegrationSection />
          </>
        )}

        {activeView === "dashboard" && (
          <Dashboard
            deals={filteredDeals}
            totalDeals={deals.length}
            filters={filters}
            filterOptions={filterOptions}
            updateFilter={updateFilter}
            resetFilters={() => setFilters(defaultFilters)}
            savedIds={savedIds}
            toggleSaved={toggleSaved}
            stats={dashboardStats}
            dataStatus={dataStatus}
            importTemplate={importTemplate}
            onImport={importDeals}
            onClearDeals={clearDeals}
            isStandalone
          />
        )}

        {activeView === "saved" && (
          <SavedDeals
            items={enrichedWatchlist}
            toggleSaved={toggleSaved}
            updateWatchItem={updateWatchItem}
            goTo={goTo}
          />
        )}

        {activeView === "flips" && (
          <FlipsView rows={ledgerRows} updateLedgerItem={updateLedgerItem} goTo={goTo} />
        )}

        {activeView === "settings" && (
          <SettingsView
            settings={pricingSettings}
            updateSettings={updatePricingSettings}
            resetSettings={restoreDefaultSettings}
          />
        )}

        {activeView === "how" && (
          <>
            <HowItWorks isStandalone />
            <RiskWarning />
            <IntegrationSection />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

function mergeOptions(baseOptions, dynamicOptions) {
  const normalized = new Map();

  [...baseOptions, ...dynamicOptions].forEach((option) => {
    if (!option) return;
    const label = String(option).trim();
    if (!label) return;
    normalized.set(label.toLocaleLowerCase("sv-SE"), label);
  });

  return [...normalized.values()];
}

function matchesConditionFilter(deal, selectedCondition) {
  if (selectedCondition === "Alla") return true;

  const haystack = `${deal.title} ${deal.condition} ${deal.sellerText} ${deal.keywordMatches?.join(" ") ?? ""}`
    .toLocaleLowerCase("sv-SE");
  const aliases = conditionAliases[selectedCondition] ?? [selectedCondition];

  return aliases.some((alias) => haystack.includes(alias.toLocaleLowerCase("sv-SE")));
}

function hasDamageSignal(deal) {
  return [
    "Trasig",
    "Defekt",
    "Skadad",
    "Sprucken skärm",
    "Laddar inte",
    "Batteriproblem",
    "Baksida sprucken",
    "Displayproblem",
    "Vattenskadad",
    "Startar inte",
    "Reservdelar",
    "Endast delar",
    "Reparationsobjekt"
  ].some((condition) => matchesConditionFilter(deal, condition));
}

function sortDealsByPreference(deals, sortBy) {
  const sortedDeals = [...deals];

  const sorters = {
    flipScore: (a, b) =>
      b.flipScore - a.flipScore ||
      b.estimatedProfit - a.estimatedProfit ||
      a.askingPrice - b.askingPrice,
    profit: (a, b) =>
      b.estimatedProfit - a.estimatedProfit ||
      b.flipScore - a.flipScore ||
      a.askingPrice - b.askingPrice,
    lowestPrice: (a, b) =>
      a.askingPrice - b.askingPrice ||
      b.estimatedProfit - a.estimatedProfit ||
      b.flipScore - a.flipScore,
    leastDamage: (a, b) =>
      getDamageSortValue(a) - getDamageSortValue(b) ||
      b.confidenceScore - a.confidenceScore ||
      b.estimatedProfit - a.estimatedProfit,
    confidence: (a, b) =>
      b.confidenceScore - a.confidenceScore ||
      b.flipScore - a.flipScore ||
      b.estimatedProfit - a.estimatedProfit
  };

  return sortedDeals.sort(sorters[sortBy] ?? sorters.flipScore);
}

function getDamageSortValue(deal) {
  const riskWeight = {
    "Låg": 0,
    Medel: 250,
    "Hög": 700
  };
  return (
    Number(deal.repairEstimate ?? 0) +
    (deal.damageTypes?.length ?? 0) * 75 +
    (riskWeight[deal.riskLevel] ?? 350)
  );
}

function Header({ activeView, goTo, savedCount, ledgerCount }) {
  const navItems = [
    ["home", "Start"],
    ["dashboard", "Dashboard"],
    ["saved", `Sparade ${savedCount ? `(${savedCount})` : ""}`],
    ["flips", `Flips ${ledgerCount ? `(${ledgerCount})` : ""}`],
    ["settings", "Inställningar"],
    ["how", "Så fungerar det"]
  ];

  return (
    <header className="site-header">
      <button className="brand" onClick={() => goTo("home")} aria-label="PhoneFlip start">
        <span className="brand-mark">
          <Smartphone size={18} />
        </span>
        <span>PhoneFlip</span>
      </button>

      <nav className="site-nav" aria-label="Huvudnavigation">
        {navItems.map(([view, label]) => (
          <button
            key={view}
            className={activeView === view ? "nav-link active" : "nav-link"}
            onClick={() => goTo(view)}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function Hero({ goTo, topDeals }) {
  return (
    <section className="hero-section">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-ambient" aria-hidden="true" />

      <div className="hero-content">
        <div className="eyebrow">
          <Radar size={16} />
          Dealradar för reparerbara iPhones
        </div>
        <h1>PhoneFlip</h1>
        <p className="hero-subtitle">
          Hitta undervärderade trasiga iPhones före alla andra.
        </p>
        <p className="hero-copy">
          Verktyget söker efter trasiga, spruckna, låsta, skadade eller
          reparerbara iPhones och räknar ut om pris, reparation och
          andrahandsvärde kan bli en lönsam flip.
        </p>

        <div className="hero-actions">
          <button className="primary-button" onClick={() => goTo("dashboard")}>
            <Zap size={18} />
            Börja hitta deals
          </button>
          <button className="secondary-button" onClick={() => goTo("how")}>
            <Info size={18} />
            Så fungerar det
          </button>
        </div>
      </div>

      <div className="hero-radar" aria-label="Förhandsvy av PhoneFlip dealradar">
        <div className="radar-header">
          <div>
            <span className="panel-kicker">Livevy</span>
            <strong>Topprankade fynd</strong>
          </div>
          <span className="pulse-dot" />
        </div>

        <div className="phone-stage">
          <div className="hero-phone hero-phone-left">
            <span />
          </div>
          <div className="hero-phone hero-phone-main">
            <span />
            <i />
          </div>
          <div className="hero-phone hero-phone-right">
            <span />
          </div>
        </div>

        <div className="radar-feed">
          {topDeals.length ? topDeals.map((deal) => (
            <div className="radar-row" key={deal.id}>
              <span className={`score-pill ${deal.dealTone}`}>{deal.flipScore}</span>
              <div>
                <strong>{deal.model}</strong>
                <p>{deal.dealLabel} · {currency.format(deal.estimatedProfit)} vinst</p>
              </div>
              <small>{deal.marketplace}</small>
            </div>
          )) : (
            <div className="radar-row empty">
              <span className="score-pill">0</span>
              <div>
                <strong>Ingen data importerad</strong>
                <p>CSV, JSON eller API fyller topplistan.</p>
              </div>
              <small>Import</small>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Dashboard({
  deals,
  totalDeals,
  filters,
  filterOptions,
  updateFilter,
  resetFilters,
  savedIds,
  toggleSaved,
  stats,
  dataStatus,
  importTemplate,
  onImport,
  onClearDeals,
  isStandalone = false
}) {
  const dealsPerPage = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const resultsTopRef = useRef(null);
  const pageCount = Math.max(1, Math.ceil(deals.length / dealsPerPage));
  const safePage = Math.min(currentPage, pageCount);
  const pageStart = deals.length ? (safePage - 1) * dealsPerPage : 0;
  const visibleDeals = deals.slice(pageStart, pageStart + dealsPerPage);
  const visibleStart = deals.length ? pageStart + 1 : 0;
  const visibleEnd = Math.min(pageStart + dealsPerPage, deals.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [deals.length, filters]);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  function goToResultsPage(page) {
    const nextPage = Math.max(1, Math.min(pageCount, page));
    setCurrentPage(nextPage);
    window.requestAnimationFrame(() => {
      resultsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <section className={isStandalone ? "dashboard-section standalone" : "dashboard-section"} id="dashboard">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            <Sparkles size={16} />
            Sökdashboard
          </span>
          <h2>Hitta annonser med verklig vinstpotential.</h2>
        </div>
        <p>
          Filtrera marknadsplatser, modeller, skick och marginaler. Resultaten
          sorteras automatiskt efter Flip Score.
        </p>
      </div>

      <div className="dashboard-layout">
        <FilterPanel
          filters={filters}
          filterOptions={filterOptions}
          updateFilter={updateFilter}
          resetFilters={resetFilters}
        />

        <div className="results-area">
          <ImportPanel
            dataStatus={dataStatus}
            importTemplate={importTemplate}
            onImport={onImport}
            onClearDeals={onClearDeals}
            totalDeals={totalDeals}
            filters={filters}
          />

          <div className="stats-row">
            <StatCard icon={Search} label="Matchande annonser" value={stats.count} />
            <StatCard
              icon={AlertTriangle}
              label="Billiga skadade"
              value={`${stats.cheapDamagedCount}/${stats.count}`}
            />
            <StatCard icon={Gauge} label="Bästa Flip Score" value={`${stats.bestScore}/100`} />
            <StatCard
              icon={TrendingUp}
              label="Snittvinst"
              value={currency.format(stats.avgProfit)}
            />
            <StatCard icon={ShieldAlert} label="Snittkonfidens" value={`${stats.avgConfidence}%`} />
          </div>

          <div className="results-toolbar" ref={resultsTopRef}>
            <div>
              <span className="panel-kicker">Sorterade efter potential</span>
              <strong>{deals.length} deals hittade</strong>
              {deals.length > dealsPerPage && (
                <span className="results-page-copy">
                  Visar {visibleStart}-{visibleEnd} av {deals.length}
                </span>
              )}
            </div>
            <div className="toolbar-badge">
              <Database size={16} />
              {totalDeals ? dataStatus.label : "Väntar på import"}
            </div>
          </div>

          <div className="deal-grid">
            {visibleDeals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                isSaved={savedIds.includes(deal.id)}
                toggleSaved={toggleSaved}
              />
            ))}
          </div>

          {deals.length > dealsPerPage && (
            <div className="pagination-bar" aria-label="Sidnavigering för annonser">
              <span className="pagination-meta">
                Sida {safePage} av {pageCount} · {dealsPerPage} annonser per sida
              </span>
              <div className="pagination-actions">
                <button
                  className="secondary-button small pagination-action previous"
                  onClick={() => goToResultsPage(safePage - 1)}
                  disabled={safePage <= 1}
                >
                  <ArrowRight size={15} />
                  Föregående
                </button>
                <button
                  className="secondary-button small pagination-action"
                  onClick={() => goToResultsPage(safePage + 1)}
                  disabled={safePage >= pageCount}
                >
                  Nästa 20
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {!deals.length && (
            <div className="empty-state">
              <ListFilter size={28} />
              <h3>{totalDeals ? "Inga annonser matchar filtren." : "Importera annonser för att börja."}</h3>
              <p>
                {totalDeals
                  ? "Justera pris, ålder eller vinstpotential för att bredda sökningen."
                  : "CSV, JSON eller en egen API-endpoint kan fylla dashboarden med riktiga annonser."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ImportPanel({ dataStatus, importTemplate, onImport, onClearDeals, totalDeals, filters }) {
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [apiLimit, setApiLimit] = useState(apiImportLimits.defaultValue);
  const [apiEstimate, setApiEstimate] = useState(() =>
    createFallbackImportEstimate(apiImportLimits.defaultValue)
  );
  const [apiProgress, setApiProgress] = useState({
    percent: 0,
    message: "",
    count: 0,
    phase: "start",
    total: apiImportLimits.defaultValue,
    remainingSeconds: 0,
    elapsedSeconds: 0,
    isRunning: false
  });

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const fallback = createFallbackImportEstimate(apiLimit);
      const minPrice = parseOptionalNumber(filters?.minPrice);
      const maxPrice = parseOptionalNumber(filters?.maxPrice);
      const estimateOptions = {
        limit: apiLimit,
        ...(minPrice !== null ? { min_price: minPrice } : {}),
        ...(maxPrice !== null ? { max_price: maxPrice } : {})
      };
      setApiEstimate({ ...fallback, isLoading: true });

      try {
        const response = await fetch(getBlocketImportEstimateUrl(estimateOptions), {
          headers: { Accept: "application/json" },
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Estimate svarade med ${response.status}`);

        const payload = await response.json();
        setApiEstimate({
          ...fallback,
          ...payload,
          isLoading: false
        });
      } catch (error) {
        if (error.name === "AbortError") return;
        setApiEstimate({ ...fallback, isLoading: false });
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [apiLimit, filters?.minPrice, filters?.maxPrice]);

  async function submitImport(input = draft, sourceName = "Textimport") {
    if (!input.trim()) return;

    setIsImporting(true);
    try {
      const result = onImport(input, sourceName);
      setDraft("");
      setFeedback(result.message);
      setFeedbackTone("success");
    } catch (error) {
      setFeedback(error.message);
      setFeedbackTone("error");
    } finally {
      setIsImporting(false);
    }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setDraft(text);
    await submitImport(text, file.name);
    event.target.value = "";
  }

  function updateApiLimit(value) {
    const nextLimit = clampImportLimit(value);
    setApiLimit(nextLimit);
    if (!apiProgress.isRunning) {
      setApiProgress({
        percent: 0,
        message: "",
        count: 0,
        phase: "start",
        total: nextLimit,
        remainingSeconds: 0,
        elapsedSeconds: 0,
        isRunning: false
      });
    }
  }

  async function importFromBlocketApi() {
    const importOptions = buildBlocketImportOptions(apiLimit, apiEstimate, filters);
    const startedAt = Date.now();

    setIsImporting(true);
    setFeedback("");
    setFeedbackTone("");
    setApiProgress({
      percent: 0,
      message: `Startar Blocket-import för ${apiLimit} annonser`,
      count: 0,
      phase: "start",
      total: apiLimit,
      remainingSeconds: Number(apiEstimate.estimatedSeconds ?? importOptions.estimatedSeconds ?? 0),
      elapsedSeconds: 0,
      isRunning: true
    });

    const startUrl = getBlocketImportStartUrl(importOptions);

    try {
      const startResponse = await fetch(startUrl, { headers: { Accept: "application/json" } });
      if (!startResponse.ok) {
        throw new Error(`Kunde inte starta importen (${startResponse.status}).`);
      }

      const startPayload = await startResponse.json();
      const jobId = startPayload.jobId;
      if (!jobId) {
        throw new Error("Importservern returnerade inget jobId.");
      }

      const statusUrl = getBlocketImportStatusUrl(jobId, startUrl);
      let statusPayload = startPayload;

      while (statusPayload.status !== "done" && statusPayload.status !== "error") {
        await wait(650);
        const statusResponse = await fetch(statusUrl, { headers: { Accept: "application/json" } });
        if (!statusResponse.ok) {
          throw new Error(`Kunde inte läsa importstatus (${statusResponse.status}).`);
        }

        statusPayload = await statusResponse.json();
        setApiProgress(createApiProgressState(statusPayload, startedAt, apiEstimate, true));
      }

      if (statusPayload.status === "error") {
        throw new Error(statusPayload.message || "Blocket-importen misslyckades.");
      }

      const result = onImport({ deals: statusPayload.deals ?? [] }, "Blocket API");
      setApiProgress({
        percent: 100,
        message: statusPayload.message || result.message,
        count: Number(statusPayload.count ?? statusPayload.deals?.length ?? 0),
        phase: "done",
        total: apiLimit,
        remainingSeconds: 0,
        elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
        isRunning: false
      });
      setFeedback(result.message);
      setFeedbackTone("success");
    } catch (error) {
      setApiProgress({
        percent: 100,
        message: error.message,
        count: 0,
        phase: "error",
        total: apiLimit,
        remainingSeconds: 0,
        elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
        isRunning: false
      });
      setFeedback(error.message);
      setFeedbackTone("error");
    } finally {
      setIsImporting(false);
    }
  }

  const statusMessage = feedback || dataStatus.message;
  const statusIsError = feedbackTone === "error" || (!feedback && dataStatus.label === "Importfel");

  return (
    <div className="import-panel">
      <div className="import-heading">
        <div>
          <span className="panel-kicker">Datakälla</span>
          <strong>Importera riktiga annonser</strong>
        </div>
        <div className="import-actions">
          <label className="secondary-button small file-button">
            <FileUp size={16} />
            Läs fil
            <input type="file" accept=".csv,.json,text/csv,application/json" onChange={importFile} />
          </label>
          <button
            className="primary-button small"
            onClick={importFromBlocketApi}
            disabled={isImporting || apiProgress.isRunning}
          >
            <Zap size={16} />
            {apiProgress.isRunning
              ? `Importerar ${Math.round(apiProgress.percent)}%`
              : "Importera från API"}
          </button>
          <button
            className="primary-button small"
            onClick={() => submitImport()}
            disabled={!draft.trim() || isImporting}
          >
            <Database size={16} />
            {isImporting ? "Importerar" : "Importera"}
          </button>
          <button className="ghost-button small" onClick={onClearDeals} disabled={!totalDeals}>
            <Trash2 size={16} />
            Rensa
          </button>
        </div>
      </div>

      <div className="api-import-controls">
        <div className="api-import-topline">
          <span>API-import</span>
          <strong>{apiLimit.toLocaleString("sv-SE")} annonser</strong>
        </div>
        <input
          type="range"
          min={apiImportLimits.min}
          max={apiImportLimits.max}
          step={apiImportLimits.step}
          value={apiLimit}
          onChange={(event) => updateApiLimit(event.target.value)}
          disabled={isImporting || apiProgress.isRunning}
          aria-label="Antal annonser att importera"
        />
        <div className="api-import-meta">
          <span>Uppskattad tid: {formatDuration(apiEstimate.estimatedSeconds)}</span>
          <span>{apiEstimate.pages} söksidor · max {apiEstimate.candidateLimit?.toLocaleString("sv-SE")} kandidater</span>
        </div>
      </div>

      <textarea
        value={draft}
        placeholder={importTemplate}
        onChange={(event) => {
          setDraft(event.target.value);
          setFeedback("");
          setFeedbackTone("");
        }}
        rows={4}
      />

      {statusMessage && (
        <p className={statusIsError ? "import-status error" : "import-status"}>
          {statusMessage}
        </p>
      )}

      {(apiProgress.isRunning || apiProgress.percent > 0) && (
        <div className="import-progress" aria-live="polite">
          <div className="progress-meta">
            <span>{formatApiPhase(apiProgress.phase)} · {apiProgress.message}</span>
            <strong>{Math.round(apiProgress.percent)}%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${Math.max(0, Math.min(100, apiProgress.percent))}%` }} />
          </div>
          <div className="progress-details">
            <span>{formatApiProgressCount(apiProgress, apiLimit)}</span>
            <span>
              {apiProgress.isRunning
                ? `Återstår: ${formatDuration(apiProgress.remainingSeconds)}`
                : `Tid: ${formatDuration(apiProgress.elapsedSeconds)}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function clampImportLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return apiImportLimits.defaultValue;
  const stepped = Math.round(number / apiImportLimits.step) * apiImportLimits.step;
  return Math.max(apiImportLimits.min, Math.min(apiImportLimits.max, stepped));
}

function parseOptionalNumber(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null;
}

function createFallbackImportEstimate(limit) {
  const normalizedLimit = clampImportLimit(limit);
  const pages =
    normalizedLimit <= 40 ? 1 : normalizedLimit <= 100 ? 2 : Math.min(50, Math.ceil(normalizedLimit / 50));
  const queryCount = 10;
  const backfillQueryCount = 20;
  const searchWorkers = 12;
  const detailWorkers = 16;
  const candidateMultiplier = 2;
  const candidateLimit = Math.max(
    normalizedLimit,
    Math.min(8000, normalizedLimit * candidateMultiplier)
  );
  const totalSearches = queryCount * pages;
  const backfillSearches = backfillQueryCount * pages;
  const minSearches = Math.min(totalSearches, 6);
  const expectedSearches = Math.min(
    totalSearches + backfillSearches,
    Math.max(minSearches, Math.round(candidateLimit / 5))
  );
  const estimatedSeconds = Math.max(
    1,
    Math.round(
      0.8 +
        (expectedSearches / searchWorkers) * 0.45
    )
  );

  return {
    limit: normalizedLimit,
    maxLimit: apiImportLimits.max,
    pages,
    queryCount,
    totalSearches,
    backfillQueryCount,
    backfillSearches,
    minSearches,
    candidateLimit,
    searchWorkers,
    detailWorkers,
    estimatedSeconds
  };
}

function buildBlocketImportOptions(limit, estimate, filters = {}) {
  const fallback = createFallbackImportEstimate(limit);
  const minPrice = parseOptionalNumber(filters.minPrice);
  const maxPrice = parseOptionalNumber(filters.maxPrice);
  return {
    limit: fallback.limit,
    pages: Number(estimate.pages ?? fallback.pages),
    candidate_limit: Number(estimate.candidateLimit ?? fallback.candidateLimit),
    details: false,
    min_searches: Number(estimate.minSearches ?? fallback.minSearches),
    search_workers: Number(estimate.searchWorkers ?? fallback.searchWorkers),
    detail_workers: Number(estimate.detailWorkers ?? fallback.detailWorkers),
    estimatedSeconds: Number(estimate.estimatedSeconds ?? fallback.estimatedSeconds),
    ...(minPrice !== null ? { min_price: minPrice } : {}),
    ...(maxPrice !== null ? { max_price: maxPrice } : {})
  };
}

function createApiProgressState(payload, startedAt, estimate, isRunning) {
  const percent = Math.max(0, Math.min(100, Number(payload.percent ?? 0)));
  const phase = payload.progressPhase ?? inferApiProgressPhase(payload.message, percent);
  const total = Number(payload.progressTotal ?? (phase === "search" ? estimate.candidateLimit : estimate.limit));
  const elapsedSeconds = Math.max(
    0,
    Number(payload.elapsedSeconds ?? Math.round((Date.now() - startedAt) / 1000))
  );
  const estimatedSeconds = Number(payload.estimatedSeconds ?? estimate.estimatedSeconds ?? 0);
  const payloadRemaining = Number(payload.remainingSeconds);
  let remainingSeconds = Number.isFinite(payloadRemaining)
    ? payloadRemaining
    : estimateRemainingSeconds(percent, elapsedSeconds, estimatedSeconds);

  if (isRunning && percent < 100 && remainingSeconds <= 0) {
    remainingSeconds = estimateRemainingSeconds(percent, elapsedSeconds, estimatedSeconds);
  }

  return {
    percent,
    message: payload.message ?? "Importerar från Blocket API",
    count: Number(payload.count ?? 0),
    phase,
    total: Number.isFinite(total) && total > 0 ? total : estimate.limit,
    remainingSeconds,
    elapsedSeconds,
    isRunning
  };
}

function inferApiProgressPhase(message = "", percent = 0) {
  const normalizedMessage = String(message).toLocaleLowerCase("sv-SE");
  if (percent >= 100 || normalizedMessage.includes("klar")) return "done";
  if (
    normalizedMessage.includes("kandidat") ||
    normalizedMessage.includes("soker") ||
    normalizedMessage.includes("söker") ||
    normalizedMessage.includes("traffar") ||
    normalizedMessage.includes("träffar")
  ) {
    return percent < 50 ? "search" : "details";
  }
  return "details";
}

function formatApiProgressCount(progress, requestedLimit) {
  const count = Math.max(0, Number(progress.count) || 0);
  const limit = Math.max(1, Number(requestedLimit) || 1);

  if (progress.phase === "search") {
    return `${count.toLocaleString("sv-SE")} kandidater hittade`;
  }

  if (progress.phase === "done") {
    return `${count.toLocaleString("sv-SE")} annonser importerade`;
  }

  if (progress.phase === "error") {
    return "Importen avbröts";
  }

  return `${Math.min(count, limit).toLocaleString("sv-SE")} av ${limit.toLocaleString("sv-SE")} annonser klara`;
}

function formatApiPhase(phase) {
  if (phase === "search") return "Söker";
  if (phase === "details") return "Kontrollerar detaljer";
  if (phase === "done") return "Poängsätter";
  if (phase === "error") return "Fel";
  return "Startar";
}

function estimateRemainingSeconds(percent, elapsedSeconds, estimatedSeconds) {
  if (percent >= 100) return 0;
  if (percent > 1) {
    return Math.max(0, Math.round(elapsedSeconds * ((100 - percent) / percent)));
  }
  return Math.max(0, Math.round(estimatedSeconds - elapsedSeconds));
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (minutes < 1) return `${remainingSeconds} s`;
  if (minutes < 60) return `${minutes} min ${remainingSeconds.toString().padStart(2, "0")} s`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} h ${remainingMinutes.toString().padStart(2, "0")} min`;
}

function FilterPanel({ filters, filterOptions, updateFilter, resetFilters }) {
  return (
    <aside className="filter-panel" aria-label="Sökfilter">
      <div className="filter-heading">
        <SlidersHorizontal size={20} />
        <div>
          <strong>Filter</strong>
          <span>Finjustera dealflödet</span>
        </div>
      </div>

      <div className="field-group">
        <label>Marknadsplats</label>
        <div className="marketplace-segment">
          {["Alla", ...filterOptions.marketplaces].map((marketplace) => (
            <button
              key={marketplace}
              className={filters.marketplace === marketplace ? "selected" : ""}
              onClick={() => updateFilter("marketplace", marketplace)}
            >
              <Store size={15} />
              {marketplace}
            </button>
          ))}
        </div>
      </div>

      <div className="field-grid">
        <Field label="Märke">
          <select
            value={filters.brand}
            onChange={(event) => updateFilter("brand", event.target.value)}
          >
            <option>Alla</option>
            {filterOptions.brands.map((brand) => (
              <option key={brand}>{brand}</option>
            ))}
          </select>
        </Field>

        <Field label="Modell">
          <input
            value={filters.model}
            placeholder="t.ex. iPhone 12"
            onChange={(event) => updateFilter("model", event.target.value)}
          />
        </Field>

        <Field label="Minpris">
          <input
            value={filters.minPrice}
            type="number"
            min="0"
            placeholder="500 kr"
            onChange={(event) => updateFilter("minPrice", event.target.value)}
          />
        </Field>

        <Field label="Maxpris">
          <input
            value={filters.maxPrice}
            type="number"
            min="0"
            placeholder="2 500 kr"
            onChange={(event) => updateFilter("maxPrice", event.target.value)}
          />
        </Field>

        <Field label="Skick">
          <select
            value={filters.condition}
            onChange={(event) => updateFilter("condition", event.target.value)}
          >
            <option>Alla</option>
            {filterOptions.conditions.map((condition) => (
              <option key={condition}>{condition}</option>
            ))}
          </select>
        </Field>

        <Field label="Köp nu">
          <select
            value={filters.buyNow}
            onChange={(event) => updateFilter("buyNow", event.target.value)}
          >
            <option>Alla</option>
            <option>Endast Köp nu</option>
            <option>Utan Köp nu</option>
          </select>
        </Field>

        <Field label="Plats">
          <input
            value={filters.location}
            placeholder="Stockholm"
            onChange={(event) => updateFilter("location", event.target.value)}
          />
        </Field>

        <Field label="Annonsens ålder">
          <select
            value={filters.ageHours}
            onChange={(event) => updateFilter("ageHours", event.target.value)}
          >
            <option value="Alla">Alla</option>
            <option value="6">Senaste 6 timmarna</option>
            <option value="24">Senaste dygnet</option>
            <option value="72">Senaste 3 dagarna</option>
          </select>
        </Field>

        <Field label="Vinstpotential">
          <select
            value={filters.profitPotential}
            onChange={(event) => updateFilter("profitPotential", event.target.value)}
          >
            <option value="Alla">Alla</option>
            <option value="150">Minst 150 kr</option>
            <option value="300">Minst 300 kr</option>
            <option value="700">Minst 700 kr</option>
            <option value="1000">Minst 1 000 kr</option>
          </select>
        </Field>

        <Field label="Risknivå">
          <select
            value={filters.riskLevel}
            onChange={(event) => updateFilter("riskLevel", event.target.value)}
          >
            <option>Alla</option>
            <option>Låg</option>
            <option>Medel</option>
            <option>Hög</option>
          </select>
        </Field>

        <Field label="Konfidens">
          <select
            value={filters.minConfidence}
            onChange={(event) => updateFilter("minConfidence", event.target.value)}
          >
            <option value="Alla">Alla</option>
            <option value="50">Minst 50%</option>
            <option value="65">Minst 65%</option>
            <option value="80">Minst 80%</option>
          </select>
        </Field>

        <Field label="Max reparation">
          <input
            value={filters.maxRepair}
            type="number"
            min="0"
            placeholder="1 200 kr"
            onChange={(event) => updateFilter("maxRepair", event.target.value)}
          />
        </Field>

        <Field label="Sortera">
          <select
            value={filters.sortBy}
            onChange={(event) => updateFilter("sortBy", event.target.value)}
          >
            <option value="flipScore">Bäst Flip Score</option>
            <option value="profit">Högst uppskattad vinst</option>
            <option value="lowestPrice">Lägst pris</option>
            <option value="leastDamage">Minsta skada</option>
            <option value="confidence">Högst konfidens</option>
          </select>
        </Field>
      </div>

      <div className="filter-checks">
        <label>
          <input
            type="checkbox"
            checked={filters.excludeLocked}
            onChange={(event) => updateFilter("excludeLocked", event.target.checked)}
          />
          Exkludera låsta/iCloud
        </label>
        <label>
          <input
            type="checkbox"
            checked={filters.excludeWater}
            onChange={(event) => updateFilter("excludeWater", event.target.checked)}
          />
          Exkludera vattenskada
        </label>
        <label>
          <input
            type="checkbox"
            checked={filters.excludeMotherboard}
            onChange={(event) => updateFilter("excludeMotherboard", event.target.checked)}
          />
          Exkludera moderkort
        </label>
      </div>

      <button className="ghost-button full-width" onClick={resetFilters}>
        Rensa filter
      </button>
    </aside>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="stat-card">
      <Icon size={19} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DealCard({ deal, isSaved, toggleSaved }) {
  return (
    <article className="deal-card">
      <div className={`product-visual ${deal.imageVariant}`}>
        <div className="phone-mock">
          <span className="camera-dot" />
          <span className="crack crack-a" />
          <span className="crack crack-b" />
        </div>
        <span className="marketplace-badge">{deal.marketplace}</span>
      </div>

      <div className="deal-body">
        <div className="deal-title-row">
          <div>
            <h3>{deal.title}</h3>
            <p>{deal.location} · {deal.ageHours} h sedan</p>
          </div>
          <div
            className={`score-meter ${deal.dealTone}`}
            style={{ "--score-angle": `${deal.flipScore * 3.6}deg` }}
          >
            <span>{deal.flipScore}</span>
            <small>/100</small>
          </div>
        </div>

        <div className="tag-row">
          <span className={`deal-label ${deal.dealTone}`}>{deal.dealLabel}</span>
          <span className={`condition-tag risk-${deal.riskLevel?.toLowerCase()}`}>
            Risk {deal.riskLevel}
          </span>
          <span className="condition-tag">{deal.confidenceScore}% konfidens</span>
          {deal.hasBuyNow && <span className="condition-tag buy-now-tag">Köp nu</span>}
          {deal.keywordMatches.slice(0, 3).map((keyword) => (
            <span key={keyword} className="condition-tag">
              {keyword}
            </span>
          ))}
        </div>

        <div className="price-grid">
          <Metric label="Annonspris" value={currency.format(deal.askingPrice)} />
          <Metric label="Maxbud" value={currency.format(deal.maxOffer)} highlight={deal.maxOffer >= deal.askingPrice} />
          <Metric label="Reparation" value={currency.format(deal.repairEstimate)} />
          <Metric label="Andrahandsvärde" value={currency.format(deal.resaleValue)} />
          <Metric
            label="Uppskattad vinst"
            value={currency.format(deal.estimatedProfit)}
            highlight={deal.estimatedProfit > 0}
          />
        </div>

        <p className="deal-reason">{deal.explanation}</p>
        {!!deal.concerns?.length && (
          <div className="deal-checklist">
            <strong>Kontrollera</strong>
            <span>{deal.concerns.slice(0, 3).join(" · ")}</span>
          </div>
        )}

        <div className="deal-actions">
          {deal.sourceUrl ? (
            <a href={deal.sourceUrl} className="secondary-button small" target="_blank" rel="noreferrer">
              <ExternalLink size={16} />
              Visa annons
            </a>
          ) : (
            <span className="secondary-button small disabled">
              <ExternalLink size={16} />
              Ingen länk
            </span>
          )}
          <button
            className={isSaved ? "primary-button small saved" : "primary-button small"}
            onClick={() => toggleSaved(deal)}
          >
            {isSaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {isSaved ? "Sparad" : "Spara deal"}
          </button>
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value, highlight = false }) {
  return (
    <div className={highlight ? "metric highlight" : "metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InlineNumber({ value, onChange }) {
  return (
    <input
      className="inline-number"
      type="number"
      min="0"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function SavedDeals({ items, toggleSaved, updateWatchItem, goTo }) {
  const deals = items.map((item) => item.deal).filter(Boolean);
  const totalProfit = deals.reduce((sum, deal) => sum + deal.estimatedProfit, 0);

  return (
    <section className="saved-section page-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            <Bookmark size={16} />
            Sparade deals
          </span>
          <h2>Jämför intressanta flips innan du kontaktar säljaren.</h2>
        </div>
        <p>
          Sparade annonser ligger kvar lokalt i webbläsaren så du kan väga
          marginal, risk och reparationskostnad mot varandra.
        </p>
      </div>

      {!items.length && (
        <div className="empty-state large">
          <Bookmark size={34} />
          <h3>Du har inga sparade deals ännu.</h3>
          <p>Gå till dashboarden och spara annonser som är värda att följa upp.</p>
          <button className="primary-button" onClick={() => goTo("dashboard")}>
            <Search size={18} />
            Öppna dashboard
          </button>
        </div>
      )}

      {!!items.length && (
        <>
          <div className="compare-summary">
            <StatCard icon={Bookmark} label="Sparade annonser" value={items.length} />
            <StatCard
              icon={TrendingUp}
              label="Total uppskattad vinst"
              value={currency.format(totalProfit)}
            />
            <StatCard
              icon={Gauge}
              label="Högsta Flip Score"
              value={`${deals.length ? Math.max(...deals.map((deal) => deal.flipScore)) : 0}/100`}
            />
          </div>

          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Modell</th>
                  <th>Status</th>
                  <th>Bud</th>
                  <th>Köp</th>
                  <th>Kostnad</th>
                  <th>Sälj</th>
                  <th>Notering</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const deal = item.deal;
                  return (
                  <tr key={item.id}>
                    <td>
                      <strong>{deal?.model ?? item.dealId}</strong>
                      <span>{deal ? `${currency.format(deal.estimatedProfit)} förväntad vinst` : "Annonsen finns inte i aktuell import"}</span>
                    </td>
                    <td>
                      <select
                        value={item.status}
                        onChange={(event) => updateWatchItem(item.dealId, { status: event.target.value })}
                      >
                        {pipelineStatuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <InlineNumber value={item.offerPrice} onChange={(value) => updateWatchItem(item.dealId, { offerPrice: value })} />
                    </td>
                    <td>
                      <InlineNumber value={item.agreedBuyPrice} onChange={(value) => updateWatchItem(item.dealId, { agreedBuyPrice: value })} />
                    </td>
                    <td>
                      <InlineNumber value={item.partsCost} onChange={(value) => updateWatchItem(item.dealId, { partsCost: value })} />
                    </td>
                    <td>
                      <InlineNumber value={item.salePrice} onChange={(value) => updateWatchItem(item.dealId, { salePrice: value })} />
                    </td>
                    <td>
                      <input
                        value={item.notes}
                        placeholder="Nästa steg"
                        onChange={(event) => updateWatchItem(item.dealId, { notes: event.target.value })}
                      />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={() => deal && toggleSaved(deal)}
                        aria-label={`Ta bort ${deal?.model ?? item.dealId} från sparade deals`}
                        title="Ta bort"
                      >
                        <Trash2 size={17} />
                      </button>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>

          <div className="deal-grid saved-grid">
            {deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                isSaved
                toggleSaved={toggleSaved}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function FlipsView({ rows, updateLedgerItem, goTo }) {
  const totals = rows.reduce(
    (sum, row) => {
      const invested = numberOrZero(row.buyPrice) + numberOrZero(row.repairCost) + numberOrZero(row.otherCosts);
      sum.invested += invested;
      sum.expectedProfit += numberOrZero(row.expectedProfit);
      sum.actualProfit += row.actualProfit;
      sum.sold += row.status === "Såld" ? 1 : 0;
      return sum;
    },
    { invested: 0, expectedProfit: 0, actualProfit: 0, sold: 0 }
  );
  const roi = totals.invested > 0 ? Math.round((totals.actualProfit / totals.invested) * 100) : 0;

  return (
    <section className="saved-section page-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            <ClipboardList size={16} />
            Flip ledger
          </span>
          <h2>Följ kapital, kostnader och faktisk vinst.</h2>
        </div>
        <p>Här blir sparade annonser riktiga affärer med inköp, reparation, avgifter och försäljning.</p>
      </div>

      {!rows.length && (
        <div className="empty-state large">
          <ClipboardList size={34} />
          <h3>Ingen ledger ännu.</h3>
          <p>Spara en deal från dashboarden så skapas en rad här automatiskt.</p>
          <button className="primary-button" onClick={() => goTo("dashboard")}>
            <Search size={18} />
            Öppna dashboard
          </button>
        </div>
      )}

      {!!rows.length && (
        <>
          <div className="compare-summary ledger-summary">
            <StatCard icon={Database} label="Investerat" value={currency.format(totals.invested)} />
            <StatCard icon={TrendingUp} label="Förväntad vinst" value={currency.format(totals.expectedProfit)} />
            <StatCard icon={Gauge} label="Faktisk vinst" value={currency.format(totals.actualProfit)} />
            <StatCard icon={BarChart3} label="ROI / Sålda" value={`${roi}% / ${totals.sold}`} />
          </div>

          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Flip</th>
                  <th>Status</th>
                  <th>Köp</th>
                  <th>Reparation</th>
                  <th>Övrigt</th>
                  <th>Sälj</th>
                  <th>Avgifter</th>
                  <th>Faktisk vinst</th>
                  <th>Notering</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.model || row.title}</strong>
                      <span>{currency.format(row.expectedProfit)} förväntat</span>
                    </td>
                    <td>
                      <select value={row.status} onChange={(event) => updateLedgerItem(row.id, { status: event.target.value })}>
                        {pipelineStatuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td><InlineNumber value={row.buyPrice} onChange={(value) => updateLedgerItem(row.id, { buyPrice: value })} /></td>
                    <td><InlineNumber value={row.repairCost} onChange={(value) => updateLedgerItem(row.id, { repairCost: value })} /></td>
                    <td><InlineNumber value={row.otherCosts} onChange={(value) => updateLedgerItem(row.id, { otherCosts: value })} /></td>
                    <td><InlineNumber value={row.salePrice} onChange={(value) => updateLedgerItem(row.id, { salePrice: value })} /></td>
                    <td><InlineNumber value={row.fees} onChange={(value) => updateLedgerItem(row.id, { fees: value })} /></td>
                    <td className={row.actualProfit >= 0 ? "profit-cell" : "loss-cell"}>{currency.format(row.actualProfit)}</td>
                    <td>
                      <input value={row.notes} onChange={(event) => updateLedgerItem(row.id, { notes: event.target.value })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function SettingsView({ settings, updateSettings, resetSettings }) {
  function updateSetting(name, value) {
    updateSettings((current) => ({ ...current, [name]: value }));
  }

  function updateResale(generation, variant, value) {
    updateSettings((current) => ({
      ...current,
      resaleValues: {
        ...current.resaleValues,
        [generation]: {
          ...current.resaleValues[generation],
          [variant]: Number(value) || 0
        }
      }
    }));
  }

  function updateRepair(generation, damage, value) {
    updateSettings((current) => ({
      ...current,
      repairCosts: {
        ...current.repairCosts,
        [generation]: {
          ...current.repairCosts[generation],
          [damage]: Number(value) || 0
        }
      }
    }));
  }

  function updateStorage(storage, value) {
    updateSettings((current) => ({
      ...current,
      storageAdjustments: {
        ...current.storageAdjustments,
        [storage]: Number(value) || 0
      }
    }));
  }

  return (
    <section className="saved-section page-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            <Settings size={16} />
            Inställningar
          </span>
          <h2>Styr pricingmotorn efter din marknad.</h2>
        </div>
        <p>Ändringar sparas lokalt och räknar om import, score, risk, maxbud och ledger-estimat.</p>
      </div>

      <div className="settings-grid">
        <section className="settings-panel">
          <div className="settings-panel-heading">
            <div>
              <span className="panel-kicker">Affärsmål</span>
              <strong>Minimikrav</strong>
            </div>
            <button className="ghost-button small" onClick={resetSettings}>
              <RotateCcw size={16} />
              Återställ
            </button>
          </div>
          <div className="field-grid">
            <Field label="Minsta vinst">
              <input type="number" value={settings.minProfit} onChange={(event) => updateSetting("minProfit", Number(event.target.value) || 0)} />
            </Field>
            <Field label="Maxbuds-buffert">
              <input type="number" value={settings.maxOfferBuffer} onChange={(event) => updateSetting("maxOfferBuffer", Number(event.target.value) || 0)} />
            </Field>
            <Field label="Risktolerans">
              <select value={settings.riskTolerance} onChange={(event) => updateSetting("riskTolerance", event.target.value)}>
                <option value="low">Låg</option>
                <option value="medium">Medel</option>
                <option value="high">Hög</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="settings-panel">
          <span className="panel-kicker">Andrahandsvärde</span>
          <div className="settings-table-wrap">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Modell</th>
                  {iphoneVariants.map((variant) => <th key={variant}>{variant}</th>)}
                </tr>
              </thead>
              <tbody>
                {iphoneGenerations.map((generation) => (
                  <tr key={generation}>
                    <td>iPhone {generation.toUpperCase()}</td>
                    {iphoneVariants.map((variant) => (
                      <td key={variant}>
                        <InlineNumber value={settings.resaleValues[generation]?.[variant] ?? 0} onChange={(value) => updateResale(generation, variant, value)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="settings-panel">
          <span className="panel-kicker">Lagringstillägg</span>
          <div className="settings-mini-grid">
            {storageOptions.map((storage) => (
              <Field label={`${storage === "1024" ? "1 TB" : `${storage} GB`}`} key={storage}>
                <InlineNumber value={settings.storageAdjustments[storage]} onChange={(value) => updateStorage(storage, value)} />
              </Field>
            ))}
          </div>
        </section>

        <section className="settings-panel wide">
          <span className="panel-kicker">Reparationskostnader</span>
          <div className="settings-table-wrap">
            <table className="settings-table repair-table">
              <thead>
                <tr>
                  <th>Fel</th>
                  {iphoneGenerations.map((generation) => <th key={generation}>iPhone {generation.toUpperCase()}</th>)}
                </tr>
              </thead>
              <tbody>
                {damageTypes.map((damage) => (
                  <tr key={damage.id}>
                    <td>{damage.label}</td>
                    {iphoneGenerations.map((generation) => (
                      <td key={generation}>
                        <InlineNumber value={settings.repairCosts[generation]?.[damage.id] ?? 0} onChange={(value) => updateRepair(generation, damage.id, value)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

function RiskWarning() {
  const risks = [
    "iCloud-låsta telefoner",
    "stulna telefoner",
    "vattenskadade telefoner",
    "telefoner med moderkortsproblem",
    "annonser med otydliga säljarbeskrivningar"
  ];

  return (
    <section className="risk-section">
      <div className="risk-copy">
        <span className="section-kicker warning">
          <ShieldAlert size={16} />
          Riskkontroll
        </span>
        <h2>Vinst är bara intressant när risken går att förstå.</h2>
        <p>
          Kontrollera alltid IMEI, be om ägarbevis eller kvitto och undvik
          annonser som känns misstänkta. PhoneFlip ska hjälpa dig sålla, inte
          ersätta sund kontroll före köp.
        </p>
      </div>
      <div className="risk-list">
        {risks.map((risk) => (
          <div className="risk-item" key={risk}>
            <AlertTriangle size={18} />
            <span>{risk}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks({ isStandalone = false }) {
  return (
    <section className={isStandalone ? "how-section page-section" : "how-section"}>
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            <Workflow size={16} />
            Så fungerar det
          </span>
          <h2>Från annons till beslutsunderlag på några sekunder.</h2>
        </div>
        <p>
          Processen kombinerar keyword-detektering, reparationsestimat och
          modellvärde för att lyfta fram de mest lovande annonserna först.
        </p>
      </div>

      <div className="step-grid">
        {processSteps.map((step, index) => (
          <article className="step-card" key={step.title}>
            <div className="step-number">{index + 1}</div>
            <step.icon size={22} />
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function IntegrationSection() {
  return (
    <section className="integration-section">
      <div className="integration-copy">
        <span className="section-kicker">
          <Database size={16} />
          Laglig integrationsdesign
        </span>
        <h2>Byggd för godkända datakällor.</h2>
        <p>
          Dashboarden använder importerad CSV/JSON eller en egen JSON-endpoint via
          VITE_PHONEFLIP_DEALS_URL. Blocket kan köras via en lokal adapter för den
          API-tjänst du angav, men marknadsplatsflöden bör i produktion kopplas
          genom API:er, RSS-flöden, godkända partnerskap eller manuell import.
        </p>
      </div>

      <div className="adapter-list">
        {marketplaceAdapters.map((adapter) => (
          <div className="adapter-row" key={adapter.name}>
            <Store size={18} />
            <div>
              <strong>{adapter.name}</strong>
              <span>{adapter.integrationType}</span>
            </div>
            <ArrowRight size={17} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <span>PhoneFlip</span>
      <p>Premium deal intelligence för reparerbara iPhones.</p>
    </footer>
  );
}

export default App;
