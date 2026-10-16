# EPEX Spot

Diese Integration bringt die **Day-Ahead-Strompreise** Ihrer Gebotszone nach
Gladys: das Ergebnis der täglichen Auktion des gekoppelten europäischen
Marktes (EPEX Spot), **viertelstündlich**. Damit verfolgen Sie den Strompreis,
starten Ihre Geräte in den günstigsten Stunden und berechnen die echten Kosten
eines **dynamischen Stromtarifs** (am Spotpreis indexierte Angebote).

Die Preise stammen aus der kostenlosen öffentlichen API von
[energy-charts.info](https://www.energy-charts.info) (Fraunhofer ISE): kein
Konto, kein API-Schlüssel. Die Integration benötigt Internetzugang
(Kennzeichnung **Cloud**).

## Unterstützte Zonen

Frankreich, Deutschland / Luxemburg, Belgien, Niederlande, Österreich,
Schweiz, Spanien, Polen, Dänemark West (DK1) und Finnland. Die Preise sind in
Euro. Die Schweiz veröffentlicht Stundenpreise: jede Stunde wird auf ihre vier
Viertelstunden verteilt.

## Konfiguration

1. Öffnen Sie den Reiter **Konfiguration** der Integration.
2. Wählen Sie Ihre **Gebotszone** (die Ihres Zählers).
3. Passen Sie bei Bedarf an:
   - das **Download-Intervall** (standardmäßig 60 Minuten, 15 bis 360). Die
     Preise für morgen erscheinen gegen 13 Uhr MEZ: bis dahin versucht es die
     Integration selbstständig alle 15 Minuten;
   - den **angezeigten Aufschlag** (€/kWh) und die **angezeigte MwSt.** (%),
     damit Gerät und Widgets einen Preis nahe Ihrer Rechnung zeigen (Marge
     des Anbieters, Netzentgelte). Sie ändern nur die Anzeige;
   - die **Preiseinheit in Widgets**: €/kWh oder €/MWh.
4. Speichern Sie und klicken Sie auf **Preis-API testen**: die Meldung zeigt
   die Zahl der empfangenen Viertelstunden und den aktuellen Preis.
5. Fügen Sie im Reiter **Erkennung** das Gerät **EPEX Spot DE-LU** (oder das
   Ihrer Zone) hinzu.

## Das Gerät

| Funktion                        | Inhalt                                  |
| ------------------------------- | --------------------------------------- |
| Current price (€/kWh)           | Preis der laufenden Viertelstunde       |
| Next quarter-hour price (€/kWh) | Preis der nächsten Viertelstunde        |
| Today minimum / average / max   | Statistik des Tages                     |
| Tomorrow average (€/kWh)        | Durchschnitt für morgen, sobald bekannt |

Die angezeigten Preise enthalten Aufschlag und MwSt. der Konfiguration. Sie
können **negativ** sein, wenn die erneuerbare Erzeugung die Nachfrage
übersteigt.

## Dynamischer Stromtarif (ab Gladys 5.2)

Die Integration speist den **Spot-Kalender** Ihrer Zone (`spot-de`,
`spot-at`…) mit dem reinen Preis jeder Viertelstunde und bietet je Zone eine
**Vertragsvorlage** im Assistenten für Energieverträge von Gladys an:
**EPEX Spot dynamisch – Deutschland / Luxemburg** usw.

Für jede Viertelstunde berechnet die Vorlage:

```
Energie = Spotpreis × Faktor + Marge
Gesamt  = (Energie + Netzentgelte) × kWh + monatliche Grundgebühr, inkl. MwSt.
```

Tragen Sie die Werte Ihres Angebots ein (Faktor, Marge, Netzentgelte und
Abgaben, Grundgebühr, MwSt.). Der **Ersatzpreis** gilt für ein Intervall ohne
veröffentlichten Spotpreis. Gladys berechnet dann die Kosten Ihres Zählers wie
bei jedem Vertrag, und die Gladys-Szenen „Vertragspreis geändert“ /
„aktueller Preis“ funktionieren ebenfalls.

Ein Kalender gehört der zuerst installierten Integration, die ihn deklariert:
speist bereits eine andere Integration `spot-de`, meldet Gladys dies im
Konfigurationsbildschirm.

## Szenen

**Auslöser:**

- **Spotpreisniveau geändert** — zur Viertelstunde wechselt der Preis in
  eine andere Stufe des Tages: _negativ_, _sehr günstig_, _günstig_,
  _normal_, _teuer_, _sehr teuer_ (Lage des Preises zwischen Minimum und
  Maximum des Tages). Filtern Sie nach den gewünschten Stufen; Variablen:
  `level`, `previous_level`, `price`.
- **Günstigste Stunden begonnen** — das günstigste zusammenhängende
  Zeitfenster des Tages (1, 2, 3, 4 oder 6 Std.) beginnt jetzt: Geschirrspüler
  starten, Auto laden oder Warmwasser bereiten. Variablen: `average_price`,
  `ends_at`.
- **Preise für morgen veröffentlicht** — einmal täglich, gegen 13 Uhr MEZ.
  Variablen: `min_price`, `max_price`, `average_price`, `cheapest_hour`,
  `negative_prices`. Ideal für eine Benachrichtigung.

**Aktionen:**

- **Spotpreis abrufen** — Ausgaben `price`, `spot_price`, `level`,
  `next_price`, `found`.
- **Günstigste Stunden finden** — Dauer (Stunden) und Zeitraum (nächste 24
  Stunden, Rest des Tages, morgen); Ausgaben `start_time`, `end_time`,
  `starts_at`, `minutes_until_start`, `average_price`, `starts_now`, `found`.
- **Ist es eine günstige Stunde?** — gibt an, ob jetzt zu den N günstigsten
  Stunden des Tages gehört (`is_cheap`, `rank`).
- **Spotpreise laden** — erzwingt einen Download.

Beispiel: „Jeden Tag um 22 Uhr die 3 günstigsten Stunden von morgen finden und
mir dann schreiben: _Auto laden von {{start_time}} bis {{end_time}}_“.

## Widgets

- **Spotpreis** — aktueller Preis (nach Stufe eingefärbt), nächster Preis,
  Minimum und Maximum des Tages, Kurve für heute und morgen mit
  „Jetzt“-Markierung, Stufe, Durchschnitt, bestes 2-Stunden-Fenster.
- **Günstigste Stunden** — die besten 1-, 2-, 3- und 4-Stunden-Fenster der
  nächsten 24 Stunden und eine Schaltfläche **Aktualisieren**.

## Fehlerbehebung

- **Kein Preis**: klicken Sie auf **Preis-API testen**. „Nicht erreichbar“
  weist auf ein Netzwerkproblem von Gladys hin; „Rate-Limit“ bedeutet zu
  viele Aufrufe der API, die Integration wartet 20 Minuten.
- **Keine Preise für morgen**: sie erscheinen gegen 13 Uhr MEZ, bei einer
  Marktstörung manchmal später.
- Die bekannten Preise werden im Volume `/data` gespeichert: ein Neustart
  verliert sie nicht.

Datenquelle: Bundesnetzagentur | SMARD.de / energy-charts.info, Lizenz CC BY
4.0 (OMIE für Spanien, private Nutzung).
