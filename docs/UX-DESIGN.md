# Personal Finance Suite — UX & Conceptual Design Document

## 1. Product Vision

Personal Finance Suite is a comprehensive, UK-focused financial planning tool designed to help individuals — particularly first-time buyers — make confident property and financial decisions. It combines property search tracking, buy-vs-rent financial modelling, location intelligence, and personal budgeting into a single, cohesive application.

The core question the app answers: **"Should I buy or rent, and can I afford it?"**

---

## 2. Target User

### Primary Persona: The First-Time Buyer (UK)

- **Age:** 25–40
- **Situation:** Currently renting, actively researching whether to buy a first property
- **Pain points:**
  - Overwhelmed by the number of properties on Rightmove/Zoopla
  - Uncertain whether buying is financially better than renting long-term
  - Struggling to compare properties across many personal criteria (commute, neighbourhood, size)
  - No clear picture of monthly affordability after accounting for all ownership costs
- **Goals:**
  - Shortlist and compare properties in one place
  - Run realistic financial projections (not back-of-napkin maths)
  - Understand total cost of ownership vs renting
  - Verify that a property fits within their budget

### Secondary Persona: The Financially Curious Renter

- Not yet ready to buy but wants to understand the financial trade-offs
- Uses the Buy Scenario and Rent vs Buy modules as educational tools
- May not sign up — uses the app in unauthenticated mode

---

## 3. Information Architecture

The application is structured as six interconnected modules, each addressing a distinct phase of the property decision journey:

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Personal Finance Suite                        │
├─────────┬──────────────┬────────────┬────────────┬─────┬───────────┤
│   Buy   │   Property   │ Comparison │  Rent vs   │ Map │  Finance  │
│Scenario │   Tracker    │    Table   │    Buy     │View │  Tracker  │
│         │ (Gaff        │            │ (Sandbox)  │     │           │
│         │  Tracker)    │            │            │     │           │
├─────────┴──────────────┴────────────┴────────────┴─────┴───────────┤
│                                                                     │
│  Journey: Configure → Collect → Compare → Analyse → Visualise →    │
│           Afford                                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Module Relationships

| Module | Purpose | Feeds Into |
|---|---|---|
| **Buy Scenario** | Define the financial parameters of a purchase | Rent vs Buy |
| **Property Tracker** | Collect and organise properties of interest | Comparison, Map, Rent vs Buy, Finance Tracker |
| **Comparison Table** | Side-by-side tabular comparison of tracked properties | Decision-making |
| **Rent vs Buy** | Long-term financial analysis of buying vs renting | Decision-making |
| **Map View** | Geographic visualisation of tracked properties | Location-based decision-making |
| **Finance Tracker** | Personal budget and affordability analysis | Final go/no-go decision |

---

## 4. Module-by-Module UX Design

### 4.1 Buy Scenario — "Configure Your Purchase"

**Purpose:** Model the full cost of buying a property, including mortgage structure, upfront costs, ongoing ownership costs, and eventual selling costs.

**Layout:** A single scrollable form divided into logical sections with collapsible panels.

**Sections:**

1. **Property Details** — Name and optional photo URL to personalise the scenario
2. **Property & Mortgage** — Purchase price, deposit (as % or £), mortgage term, fixed-rate period and rate, revert rate
3. **Upfront Buying Costs** — Stamp duty (auto-calculated with first-time buyer relief toggle), solicitor fees, survey costs, moving costs
4. **Owner-Only Monthly Costs** — Maintenance, service charge, buildings insurance, life insurance, boiler cover, ground rent
5. **Selling Costs** — Estate agent commission (%), conveyancing, EPC certificate

**Key Interactions:**

- **Stamp duty auto-calculation:** As the user types a purchase price, stamp duty updates in real time using current UK rates. A "First-time buyer" toggle applies the appropriate relief.
- **Deposit toggle:** Users switch between entering deposit as a percentage or a fixed amount. The other value updates automatically.
- **Save/Load:** Authenticated users can save named scenarios and reload them later. A scenario manager modal lists all saved scenarios with load and delete options.

**UX Principles:**

- Pre-fill sensible UK defaults (e.g. 10% deposit, 25-year term, 4.5% fixed rate) so users can get a useful result immediately
- Show calculated values (monthly payment, total stamp duty) inline, not hidden behind a submit button
- Keep the form approachable — advanced fields like ground rent and boiler cover are in clearly labelled sections the user can skip

---

### 4.2 Property Tracker (Gaff Tracker) — "Collect Your Shortlist"

**Purpose:** A personal property database where users save, annotate, and organise properties they are interested in — whether for renting or buying.

**Layout:** A filterable, sortable card grid (or list view) of properties with an "Add Property" form.

**Adding a Property:**

1. Click "Add Property" to open the inline form
2. Enter core details: name, type (flat/house/etc.), listing type (rent or buy), price, bedrooms, bathrooms, size, location, website link, notes
3. Add photos via:
   - **Paste URL** — ideal for copying image URLs from Rightmove/Zoopla listings
   - **Upload from device** — opens a crop modal with zoom control
4. Designate one photo as the "main" photo (shown on the card)
5. Add notes to individual photos (e.g. "nice kitchen", "small bedroom 2")

**Custom Fields — "Things I Care About":**

This is a standout feature. Users define their own criteria for evaluating properties:

- Click the settings gear icon to manage custom fields
- Create fields like "Commute Time", "Natural Light", "Neighbourhood Feel"
- Choose field type:
  - **Number** — enter a raw numeric value (e.g. commute in minutes)
  - **Ranking** — rate on a 1–5 scale
- Once created, every property card shows these fields for rating
- Filter and sort the property list by custom field values

**Filtering & Sorting:**

- Filter by: min/max bedrooms, max price, custom field thresholds
- Sort by: date added, price, bedrooms, any custom field ranking
- Switch between grid and list views

**UX Principles:**

- The tracker should feel like a personal scrapbook, not a database form
- Photo management is first-class — property decisions are visual, so photos deserve dedicated UX
- Custom fields let every user tailor the tool to what matters to them personally (some care about garden size, others about pub proximity)

---

### 4.3 Comparison Table — "See Everything Side by Side"

**Purpose:** A spreadsheet-style view of all tracked properties for quick, structured comparison.

**Layout:** A responsive table with properties as rows and attributes as columns.

**Features:**

- **Column customisation:** A "Customise" dialog lets users show/hide columns for standard fields (price, beds, baths, size, location) and all custom fields
- **Sorting:** Click any column header to sort
- **Filtering:** Same filter controls as the Property Tracker
- **Listing type tabs:** Separate views for rental properties and purchase properties

**UX Principles:**

- This is the "spreadsheet view" for users who want to compare hard numbers
- Complement, don't replace, the visual card-based tracker
- Keep it scannable — avoid information overload by letting users choose which columns matter

---

### 4.4 Rent vs Buy (Sandbox) — "Run the Numbers"

**Purpose:** The analytical core of the application. Compares the long-term financial outcome of buying (using a saved Buy Scenario) versus renting (using a property from the Tracker) over a configurable time horizon.

**Layout:** Two-panel input area at top, followed by tabbed analysis results below.

**Inputs (Top Section):**

- **Left panel:** Select a saved Buy Scenario (dropdown of previously saved scenarios)
- **Right panel:** Select a rental property from the Gaff Tracker (auto-fills monthly rent)
- **Assumptions bar:** House price growth rate, investment return rate, rent inflation rate, time horizon (years)

**Analysis Outputs (Tabbed):**

#### Short-Term Analysis Tab

Answers: "Month by month, which option costs me less?"

- **Monthly cost comparison chart** — Side-by-side bar chart of total monthly outgoings for buying vs renting
- **Cumulative cost chart** — Line chart showing total money spent over time for each option
- **Break-even indicator** — The month where cumulative buying costs drop below cumulative renting costs (annotated on the chart)

#### Long-Term Analysis Tab

Answers: "After N years, which option leaves me wealthier?"

- **Wealth accumulation chart** — For the buyer: home equity growth. For the renter: investment portfolio growth (assuming the renter invests the monthly savings from cheaper rent)
- **Net wealth comparison** — Final values at the end of the time horizon
- **Sensitivity table** — A matrix showing break-even years across different combinations of property growth rates and time horizons. Cells are colour-coded (green = buying wins quickly, amber = toss-up, red = renting wins)

**Key Interactions:**

- **Interactive charts:** All charts support zoom (scroll wheel), pan (drag), and reset (double-click)
- **CSV export:** Download the underlying data for any chart
- **Assumption sliders:** Changing any assumption instantly recalculates all charts and metrics

**UX Principles:**

- Lead with the answer: surface the key metric ("Buy breaks even in 7 years" or "Renting is cheaper for the first 12 years") prominently before showing charts
- Make assumptions transparent and adjustable — users should never wonder "but what if house prices only grow 2%?"
- The sensitivity table is the power-user feature: it shows how robust the conclusion is across a range of assumptions

---

### 4.5 Map View — "See Where Everything Is"

**Purpose:** Visualise tracked properties geographically to support location-based decision-making.

**Layout:** Full-width Google Map with property markers and a filter sidebar.

**Features:**

- **Property markers:** Each tracked property with a valid location is geocoded and placed on the map
- **Marker styling:**
  - Colour reflects ranking (green = highest rated, red = lowest rated based on custom fields)
  - Size reflects relative ranking
- **Click interaction:** Clicking a marker shows a popup with property details and photo
- **Workplace & landmarks:**
  - Users set a workplace address (saved to their profile)
  - Users add custom landmarks (e.g. "Mum's house", "favourite gym")
  - Distance from each property to workplace/landmarks is calculated and cached
- **Filters:** Same filter controls as Property Tracker (beds, price, custom fields, listing type)

**UX Principles:**

- The map turns an abstract spreadsheet of properties into a spatial story
- Workplace/landmark distances answer the question "how does my daily life look from this property?"
- Geocoding results are cached to minimise API calls and keep the experience fast

---

### 4.6 Finance Tracker — "Can I Actually Afford This?"

**Purpose:** Personal budgeting tool that connects a selected property to the user's real income and expenses, answering the final affordability question.

**Layout:** A dashboard with income/expense inputs on the left and visual indicators on the right.

**Inputs:**

- **Select a property** — Choose any tracked property (rent or buy) to anchor the analysis
- **Monthly income** — Net take-home pay
- **Housing costs** — Auto-filled from the selected property, adjustable
- **Expense categories:**
  - Utilities (energy, water, broadband, council tax)
  - Transport (car, public transport, fuel)
  - Food (groceries, dining out)
  - Lifestyle (subscriptions, clothing, hobbies)
  - Financial (pension top-up, savings, debt repayment)
  - Irregular (holidays, gifts, emergency fund)

**Outputs:**

- **Housing affordability ratio** — Housing costs as a percentage of income, with a traffic-light indicator:
  - Great (< 35%) — green
  - Normal (35–45%) — amber
  - Tight (45–55%) — orange
  - Stretched (> 55%) — red
- **Savings rate** — Percentage of income remaining after all expenses
  - Good (> 20%) — green
  - OK (10–20%) — amber
  - Low (< 10%) — red
- **Budget balance** — Visual bar showing income vs total outgoings
- **5-year wealth projection** — Chart showing estimated savings/investment growth over 5 years

**Multi-Currency Support:**

- Users can switch display currency (GBP, USD, HKD, ZAR)
- Live exchange rates fetched from open.er-api.com (cached for 24 hours)
- All values convert in real time when currency is changed

**Council Tax Integration:**

- Users select a council tax band (A–H)
- Monthly estimate auto-fills using London-averaged rates

**UX Principles:**

- This module is the "reality check" — it grounds the aspirational property search in actual budget constraints
- Traffic-light indicators give instant, at-a-glance feedback without requiring financial literacy
- The connection to a specific tracked property makes the analysis concrete, not abstract

---

## 5. Cross-Cutting UX Patterns

### 5.1 Authentication

- **Unauthenticated access:** Users can freely use the Buy Scenario form and the Rent vs Buy calculator without signing up. This lowers the barrier to entry and lets users see value before committing.
- **Authentication prompt:** When a user tries to save a scenario, track a property, or access the map, they are prompted to sign in via a modal.
- **Sign-up flow:** Email + password, with an optional display name. Minimal friction — no email verification required.
- **Profile:** Users can upload an avatar (with crop support) and set a display name. These appear in the header for a personal touch.

### 5.2 Data Persistence

| Data | Storage | Scope |
|---|---|---|
| Buy/rent scenarios | Supabase (PostgreSQL) | Per user, cloud-synced |
| Tracked properties | Supabase (PostgreSQL) | Per user, cloud-synced |
| Property photos | Supabase Storage | Per user, public URLs |
| Custom fields | Supabase (PostgreSQL) | Per user |
| Currency preference | localStorage | Per browser |
| Geocoding cache | In-memory | Per session |
| FX rates | localStorage | 24-hour TTL |

### 5.3 Responsive Design

- **Breakpoint:** 640px (mobile vs desktop)
- **Mobile adaptations:**
  - Navigation tabs scroll horizontally
  - Forms stack vertically
  - Charts resize to fit viewport
  - Property cards switch from grid to single-column
- **Desktop optimisations:**
  - Content area capped at 1100px for readability
  - Side-by-side panels where space allows (e.g. Rent vs Buy input selectors)

### 5.4 Visual Design Language

- **Typography:** Instrument Sans (body/UI) and Instrument Serif (headings/accents) — a clean, modern pairing that feels trustworthy for financial content
- **Colour palette:**
  - Neutral base: near-black text (#1a1a1a) on white, with light grey borders (#e5e5e5)
  - Semantic accents: green (positive/good), red (negative/bad), amber (caution/neutral)
  - Charts use a curated palette for line/bar differentiation
- **Tone:** Professional but approachable. Financial tools can feel intimidating — the UI uses clear labels, sensible defaults, and contextual guidance to keep things accessible.

### 5.5 UK-Specific Financial Logic

The app embeds real UK financial rules:

- **Stamp Duty Land Tax (SDLT):** Calculated using current rates with first-time buyer relief (no stamp duty up to £425,000, reduced rate up to £625,000)
- **Council tax bands:** Monthly estimates based on London-averaged rates for bands A–H
- **Mortgage conventions:** Fixed-rate periods followed by Standard Variable Rate (SVR) reversion, as is standard in UK mortgage products
- **Currency default:** GBP, with multi-currency support for internationally mobile users

---

## 6. Intended User Journey

The app is designed to support a linear decision-making journey, though users can enter at any module:

```
Step 1                Step 2               Step 3              Step 4
CONFIGURE             COLLECT              ANALYSE             DECIDE
────────────────      ─────────────────    ─────────────────   ─────────────────

Define what buying     Save properties      Compare buy vs      Check affordability
looks like for you     you're interested    rent outcomes for    against your actual
(Buy Scenario)         in (Gaff Tracker)    your shortlist       budget (Finance
                                            (Rent vs Buy,        Tracker)
                                             Comparison,
                                             Map View)
```

### Walkthrough: A Typical First Session

1. **Land on Buy Scenario.** The user sees a pre-filled form with sensible defaults. They adjust the purchase price to match their target area and tweak the deposit to match their savings. They toggle "first-time buyer" and see stamp duty update. They save the scenario as "London 2-bed flat".

2. **Open Property Tracker.** The user adds three properties they found on Rightmove. For each, they paste the listing URL, enter the price and bedroom count, and paste a photo URL from the listing page. They create two custom fields: "Commute (mins)" and "Vibe" (ranking 1–5). They rate each property.

3. **Check the Map.** The user sets their workplace address. The three properties appear on the map with colour-coded markers. They can see at a glance which property is closest to work and which is in the area they rated highest for "Vibe".

4. **Open Comparison Table.** The user enables the "Commute" and "Vibe" columns alongside price and bedrooms. They sort by price to see the cheapest option and then by Vibe to see their favourite.

5. **Run Rent vs Buy.** The user selects their saved "London 2-bed flat" buy scenario and picks one of the rental properties. The tool shows that buying breaks even in 8 years and that, over 25 years, buying builds £180k more wealth — but the sensitivity table reveals this is highly dependent on house price growth. At 2% growth instead of 3.5%, renting and investing wins.

6. **Check Affordability.** The user selects their preferred property in the Finance Tracker, enters their monthly take-home pay, and fills in estimated expenses. The affordability ratio shows 42% — "Normal" but close to "Tight". They see that reducing lifestyle spending by £150/month would bring them into the "Great" zone.

7. **Decision.** Armed with financial projections, property comparisons, location context, and a clear budget picture, the user can make an informed decision about whether to proceed with an offer.

---

## 7. Design Principles

1. **Defaults over blank slates.** Every form ships with sensible UK defaults. The user should see a useful result before typing a single character.

2. **Progressive disclosure.** Core fields are always visible; advanced options (boiler cover, EPC cost, ground rent) are in clearly labelled sections that can be skipped.

3. **Show the answer first.** Key metrics (break-even point, affordability ratio, wealth difference) are surfaced prominently. Charts and tables support the headline, not replace it.

4. **Make assumptions transparent.** Every financial projection depends on assumptions (growth rates, inflation, returns). These are always visible, always adjustable, and their impact is shown immediately.

5. **Personal, not generic.** Custom fields, property photos, workplace distance — the app adapts to what each individual user cares about, rather than imposing a one-size-fits-all framework.

6. **Low barrier, high ceiling.** Unauthenticated users can run a buy-vs-rent analysis in 30 seconds. Authenticated power users can manage a portfolio of properties with custom rankings, photo galleries, and sensitivity analysis.

7. **Trust through transparency.** Financial calculations (stamp duty, mortgage payments, wealth projections) use clearly documented UK rules and formulas. The user can always see how a number was derived.

---

## 8. Technical UX Considerations

### Performance

- **Instant calculations:** All financial modelling runs client-side in the browser. There is no server round-trip for recalculating scenarios — results update as the user types.
- **Lazy geocoding:** Map markers are geocoded on first view and cached. Subsequent visits reuse cached coordinates.
- **Chart interactivity:** Charts use Chart.js with the zoom plugin, supporting scroll-to-zoom and drag-to-pan for exploring long time horizons.

### Data Safety

- **Row-level security:** Supabase enforces that users can only access their own data at the database level. There is no way for one user to see another's properties or scenarios.
- **No sensitive data storage:** The app does not store bank details, income figures, or other sensitive financial data server-side. Budget inputs in the Finance Tracker are session-only and not persisted.

### Offline Resilience

- **Currency preference** and **exchange rates** are cached in localStorage, so the app works with stale-but-functional FX data even when offline.
- **Unauthenticated mode** works entirely without network calls (no Supabase dependency), allowing basic scenario modelling offline.

---

## 9. Future UX Opportunities

The architecture supports natural extensions:

- **Shared scenarios:** Allow users to share a buy-vs-rent analysis with a partner or financial advisor via a shareable link
- **Property alerts:** Integrate with Rightmove/Zoopla APIs to notify users when properties matching their criteria are listed
- **Mortgage comparison:** Compare offers from multiple lenders, not just a single rate assumption
- **Tax modelling:** Capital gains tax projections for investment properties
- **Multi-property portfolios:** Support for users considering buy-to-let alongside primary residence purchase
- **Collaboration:** Shared property trackers for couples making joint decisions

---

## 10. Glossary

| Term | Definition |
|---|---|
| **Buy Scenario** | A saved configuration of purchase parameters (price, deposit, mortgage, costs) |
| **Gaff** | British slang for a house or flat — used as the name for the Property Tracker |
| **Break-even point** | The month at which the cumulative cost of buying becomes less than renting |
| **Sensitivity table** | A matrix showing how a metric (e.g. break-even) changes across two variable axes |
| **SDLT** | Stamp Duty Land Tax — the UK tax paid when purchasing property above certain thresholds |
| **SVR / Revert rate** | Standard Variable Rate — the interest rate a mortgage reverts to after the fixed-rate period ends |
| **FTB** | First-Time Buyer — eligible for stamp duty relief in the UK |
| **Affordability ratio** | Housing costs as a percentage of net monthly income |
| **Custom fields** | User-defined property attributes (e.g. "Garden Size", "School Rating") for personalised comparison |
