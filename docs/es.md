# EPEX Spot

Esta integración trae a Gladys los **precios day-ahead de la electricidad** de
su zona de oferta: el resultado de la subasta diaria del mercado europeo
acoplado (EPEX Spot), **cada cuarto de hora**. Sirve para seguir el precio de
la electricidad, poner en marcha sus aparatos en las horas más baratas y
calcular el coste real de un **contrato eléctrico dinámico** (ofertas
indexadas al precio spot).

Los precios proceden de la API pública y gratuita de
[energy-charts.info](https://www.energy-charts.info) (Fraunhofer ISE): sin
cuenta ni clave de API. La integración necesita acceso a Internet (etiqueta
**cloud**).

## Zonas disponibles

Francia, Alemania / Luxemburgo, Bélgica, Países Bajos, Austria, Suiza,
España, Polonia, Dinamarca Oeste (DK1) y Finlandia. Los precios están en
euros. Suiza publica precios horarios: cada hora se reparte en sus cuatro
cuartos de hora. Para España, los precios son los del mercado diario acoplado
(OMIE).

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. Elija su **zona de oferta** (la de su contador).
3. Si lo necesita, ajuste:
   - el **intervalo de descarga** (60 minutos por defecto, de 15 a 360). Los
     precios de mañana se publican hacia las 13:00 CET: mientras tanto, la
     integración reintenta cada 15 minutos por sí sola;
   - el **recargo mostrado** (€/kWh) y el **IVA mostrado** (%), para que el
     dispositivo y los widgets muestren un precio cercano a su factura
     (margen del comercializador, peajes). Solo cambian lo que se muestra;
   - la **unidad de precio en widgets**: €/kWh o €/MWh.
4. Guarde y pulse **Probar la API de precios**: el mensaje indica cuántos
   cuartos de hora se recibieron y el precio actual.
5. En la pestaña **Descubrimiento**, añada el dispositivo **EPEX Spot ES** (o
   el de su zona).

## El dispositivo

| Función                         | Contenido                             |
| ------------------------------- | ------------------------------------- |
| Current price (€/kWh)           | precio del cuarto de hora actual      |
| Next quarter-hour price (€/kWh) | precio del siguiente cuarto de hora   |
| Today minimum / average / max   | estadísticas del día                  |
| Tomorrow average (€/kWh)        | media de mañana, en cuanto se publica |

Los precios mostrados incluyen el recargo y el IVA de la configuración.
Pueden ser **negativos** cuando la producción renovable supera la demanda.

## Contrato eléctrico dinámico (Gladys 5.2 y posteriores)

La integración alimenta el **calendario spot** de su zona (`spot-es`,
`spot-fr`…) con el precio bruto de cada cuarto de hora, y ofrece una
**plantilla de contrato** por zona en el asistente de contratos de energía de
Gladys: **EPEX Spot dinámico – España**, etc.

Para cada cuarto de hora, la plantilla calcula:

```
energía = precio spot × coeficiente + margen
total   = (energía + peajes) × kWh + término fijo mensual, IVA incluido
```

Introduzca los valores de su oferta (coeficiente, margen, peajes y cargos,
término fijo, IVA). El **precio de reserva** se aplica a un intervalo sin
precio spot publicado. Gladys calcula entonces los costes de su contador como
con cualquier contrato, y sus propias escenas «precio del contrato cambiado» /
«precio actual» también funcionan.

Un calendario pertenece a la primera integración instalada que lo declara: si
otra integración ya alimenta `spot-es`, Gladys lo indica en la pantalla de
configuración.

## Escenas

**Disparadores:**

- **Nivel del precio spot cambiado** — en un cuarto de hora, el precio pasa
  a otro nivel del día: _negativo_, _muy barato_, _barato_, _normal_, _caro_,
  _muy caro_ (posición del precio entre el mínimo y el máximo del día).
  Filtre por los niveles deseados; variables: `level`, `previous_level`,
  `price`.
- **Horas más baratas iniciadas** — empieza la franja continua más barata del
  día (1, 2, 3, 4 o 6 h): ponga el lavavajillas, cargue el coche o caliente
  el termo. Variables: `average_price`, `ends_at`.
- **Precios de mañana publicados** — una vez al día, hacia las 13:00 CET.
  Variables: `min_price`, `max_price`, `average_price`, `cheapest_hour`,
  `negative_prices`. Ideal para una notificación.

**Acciones:**

- **Obtener el precio spot** — salidas `price`, `spot_price`, `level`,
  `next_price`, `found`.
- **Buscar las horas más baratas** — duración (horas) y periodo (próximas 24
  horas, resto del día, mañana); salidas `start_time`, `end_time`,
  `starts_at`, `minutes_until_start`, `average_price`, `starts_now`, `found`.
- **¿Es una hora barata?** — indica si ahora está entre las N horas más
  baratas del día (`is_cheap`, `rank`).
- **Descargar los precios spot** — fuerza una descarga.

Ejemplo: «Cada día a las 22:00, buscar las 3 horas más baratas de mañana y
enviarme un mensaje: _Carga del coche de {{start_time}} a {{end_time}}_».

## Widgets

- **Precio spot** — precio actual (con el color de su nivel), precio
  siguiente, mínimo y máximo del día, curva de hoy y de mañana con una marca
  «ahora», nivel, media, mejor franja de 2 h.
- **Horas más baratas** — las mejores franjas de 1, 2, 3 y 4 h de las
  próximas 24 horas, y un botón **Actualizar**.

## Solución de problemas

- **Sin precio**: pulse **Probar la API de precios**. «No se puede acceder»
  indica un problema de red de Gladys; «límite de peticiones» indica
  demasiadas llamadas a la API, la integración espera 20 minutos.
- **Sin precios de mañana**: se publican hacia las 13:00 CET, a veces más
  tarde si el mercado sufre una incidencia.
- Los precios conocidos se guardan en el volumen `/data`: un reinicio no los
  pierde.

Fuente de datos: Bundesnetzagentur | SMARD.de / energy-charts.info, licencia
CC BY 4.0 (OMIE para España, uso privado).
