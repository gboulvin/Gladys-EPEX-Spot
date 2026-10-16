# EPEX Spot

This integration brings the **day-ahead electricity prices** of your bidding
zone into Gladys: the result of the daily auction of the coupled European
market (EPEX Spot), **every quarter-hour**. Use it to follow the price of
electricity, to run your appliances at the cheapest hours and to compute the
real cost of a **dynamic electricity contract** (offers indexed on the spot
price).

Prices come from the free public API of
[energy-charts.info](https://www.energy-charts.info) (Fraunhofer ISE): no
account, no API key. The integration needs Internet access (**cloud** tag).

## Supported zones

France, Germany / Luxembourg, Belgium, Netherlands, Austria, Switzerland,
Spain, Poland, Denmark West (DK1) and Finland. Prices are in euros.
Switzerland publishes hourly prices: each hour is spread over its four
quarter-hours.

## Configuration

1. Open the **Configuration** tab of the integration.
2. Pick your **bidding zone** (the one of your meter).
3. If needed, adjust:
   - the **download interval** (60 minutes by default, 15 to 360). Tomorrow's
     prices are published around 13:00 CET: while waiting for them, the
     integration retries every 15 minutes on its own;
   - the **markup shown** (€/kWh) and the **VAT shown** (%), so the device and
     the widgets show a price close to your bill (supplier margin, grid fees).
     They only change what is displayed;
   - the **price unit in widgets**: €/kWh or €/MWh.
4. Save, then click **Test the price API**: the message shows how many
   quarter-hours were received and the current price.
5. In the **Discovery** tab, add the **EPEX Spot FR** device (or the one of
   your zone).

## The device

| Feature                         | Content                            |
| ------------------------------- | ---------------------------------- |
| Current price (€/kWh)           | price of the current quarter-hour  |
| Next quarter-hour price (€/kWh) | price of the next quarter-hour     |
| Today minimum / average / max   | statistics of the day              |
| Tomorrow average (€/kWh)        | tomorrow's average, once published |

The shown prices include the markup and VAT of the configuration. They can be
**negative** when renewable production exceeds demand.

## Dynamic electricity contract (Gladys 5.2 and later)

The integration feeds the **spot calendar** of your zone (`spot-fr`,
`spot-de`…) with the raw price of every quarter-hour, and offers one
**contract template** per zone in the Gladys energy contract wizard: **EPEX
Spot dynamic – France**, and so on.

For every quarter-hour, the template computes:

```
energy = spot price × coefficient + margin
total  = (energy + grid fees) × kWh + monthly subscription, VAT included
```

Fill in the values of your offer (coefficient, margin, grid fees and taxes,
subscription, VAT). The **fallback price** applies to an interval without a
published spot price. Gladys then computes the costs of your meter like for
any contract, and its own "contract price changed" / "current price" scenes
work too.

A calendar belongs to the first installed integration declaring it: if
another integration already feeds `spot-fr`, Gladys says so and the
Configuration screen shows it.

## Scenes

**Triggers:**

- **Spot price level changed** — at a quarter-hour, the price moves to
  another level of the day: _negative_, _very cheap_, _cheap_, _normal_,
  _expensive_, _very expensive_ (position of the price between the minimum
  and the maximum of the day). Filter on the levels you want; variables:
  `level`, `previous_level`, `price`.
- **Cheapest hours started** — the cheapest contiguous window of the day
  (1, 2, 3, 4 or 6 hours) starts now: run the dishwasher, charge the car or
  heat the water tank. Variables: `average_price`, `ends_at`.
- **Tomorrow's prices published** — once a day, around 13:00 CET. Variables:
  `min_price`, `max_price`, `average_price`, `cheapest_hour`,
  `negative_prices`. Perfect for a notification.

**Actions:**

- **Get the spot price** — outputs `price`, `spot_price`, `level`,
  `next_price`, `found`.
- **Find the cheapest hours** — length (hours) and period (next 24 hours,
  rest of today, tomorrow); outputs `start_time`, `end_time`, `starts_at`,
  `minutes_until_start`, `average_price`, `starts_now`, `found`.
- **Is it a cheap hour?** — tells whether now is among the N cheapest hours
  of the day (`is_cheap`, `rank`).
- **Download the spot prices** — forces a download.

Example: "Every day at 22:00, find the 3 cheapest hours of tomorrow, then send
me a message: _Car charging from {{start_time}} to {{end_time}}_".

## Widgets

- **Spot price** — current price (colored by level), next price, minimum and
  maximum of the day, curve of today and tomorrow with a "now" marker, level,
  average, best 2-hour window.
- **Cheapest hours** — the best 1, 2, 3 and 4-hour windows of the next 24
  hours, and a **Refresh** button.

## Troubleshooting

- **No price**: click **Test the price API**. "Unreachable" points to a
  network problem of Gladys; "rate limit" means too many calls to the API,
  the integration waits 20 minutes.
- **No price for tomorrow**: they are published around 13:00 CET, sometimes
  later when the market has an incident.
- The known prices are kept in the `/data` volume: a restart does not lose
  them.

Data source: Bundesnetzagentur | SMARD.de / energy-charts.info, licensed CC BY
4.0 (OMIE for Spain, private use).
