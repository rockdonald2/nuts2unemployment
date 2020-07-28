(function (nviz) {
    'use strict';

    /* alapvető változók, ábrakonténer, utána lekérjük a méreteit */
    const mapContainer = d3.select('#nuts-map');
    const boundingRect = mapContainer.node().getBoundingClientRect();
    const width = boundingRect.width;
    let height;
    let svg;
    let path;

    /* ezzel fogjuk színezni mind az ábrát, mind a jelmagyarázatot */
    const colors = d3.range(9)
        .map(function (i) {
            return "q" + i + "-9"
        });

    /* színskála, a munkanélküliségi ráta alapján feleltet meg neki egy színt */
    const colorScale = d3.scaleThreshold().domain([3, 4, 5, 6, 7, 8, 9, 10]).range(colors);

    /* tooltip selector */
    const tooltip = d3.select('#map-tooltip');

    /* időválasztó */
    const sliderValues = d3.range(2015, 2020);

    const sliderTime = d3.sliderBottom().min(d3.min(sliderValues)).max(d3.max(sliderValues)).step(1).width(300)
        .tickFormat(d3.format('d')).tickValues(sliderValues).on('onchange', function (v) {
            nviz.CURRENTTIME = parseInt(v);
            nviz.onDataChange();
        }).default(sliderValues[sliderValues.length - 1]);

    const gTime = d3.select('#sliderTime').append('svg').attr('width', 350).attr('height', 100).append('g').attr('transform', 'translate(20, 30)').call(sliderTime)
        .selectAll('text').style('font-size', '1.2rem');

    const makeLegend = function () {
        const scale = d3.scaleOrdinal().domain([0, 1, 2, 3, 4, 5, 6, 7, 8]).range([0, 29, 58, 87, 116, 144, 173, 202, 231]);

        const legend = svg.append('g').attr('class', 'legend').attr('transform', 'translate(' + (height * 0.85) + ', 100)');
        const cells = legend.append('g').attr('class', 'cells');
        const labels = legend.append('g').attr('class', 'labels').attr('transform', 'translate(11, 29)');

        for (let i = 0; i < 8; i++) {
            cells.append('rect').attr('height', 29).attr('width', 18).attr('x', 18).attr('y', function (d) {
                return scale(i);
            }).attr('class', function (d) {
                return colorScale(i + 3);
            });
        }

        for (let i = 0; i < 7; i++) {
            const tick = labels.append('g').attr('class', 'tick').attr('transform', function (d) {
                return 'translate(0, ' + (scale(i) + 0.5) + ')';
            });

            tick.append('line').attr('stroke', '#222').attr('x2', 6).attr('x1', 26);
            tick.append('text').attr('fill', '#222').attr('dx', '-1.5em').attr('dy', '0.29em').text(i + 3 + '%').style('font-size', '1.1rem');
        }
    };

    /* az a függvény, amely létrehozza a térképet és fel is tölti adatokkal */
    nviz.initMap = function () {
        /* első dolgunk a dokumentáció szerinti megfelelő magasságot megkapni, ami meghatározza a projection-t */
        height = width * (nviz.data.nutsMap.bbox[3] - nviz.data.nutsMap.bbox[1]) / (nviz.data.nutsMap.bbox[2] - nviz.data.nutsMap.bbox[0]);

        /* létrehozzuk az svg kontextust a magasággal és széleséggel */
        svg = mapContainer.append('svg').attr('height', height).attr('width', width);

        /* létrehozzuk a path generátort, a geoIdentity() projectiont úgy meghatározva, hogy megfeleljen a mellékelt graticule-nek
            de ezt nem fogjuk használni
        */
        path = d3.geoPath().projection(d3.geoIdentity().reflectY(true).fitSize([width, height], topojson.feature(nviz.data.nutsMap, nviz.data.nutsMap.objects.gra)));

        /* lekérjük az ország path-eket, amelyeket arra fogunk használni, hogy hozzáillesszük az adatsorunkhoz a GeoJSON shape-jüket */
        const countriesShapes = topojson.feature(nviz.data.nutsMap, nviz.data.nutsMap.objects.nutsrg).features;

        countriesShapes.forEach(function (c) {
            if (nviz.data.nutsData.hasOwnProperty(c.properties.id)) {
                nviz.data.nutsData[c.properties.id]['geo'] = c;
            }
        });

        /* hozzáadjuk az országhatár path-eket, classal színezve őket jelenleg 
            a logika úgy van, hogy tengerparti határok külön szín, NUTS0 határok külön szín, NUTS2 külön szín,
            akkor is fehér a határ, ha egy olyan országot érint, amely nem EU
        */
        const borders = svg.append('g').attr('class', 'boundaries').selectAll('path').data(topojson.feature(nviz.data.nutsMap, nviz.data.nutsMap.objects.nutsbn).features)
            .enter().append('path').attr('d', path).attr('class', function (bn) {
                return "nutsbn" + (bn.properties.co === 'T' ? ' coastal' : '') + ((bn.properties.oth === 'T' || bn.properties.lvl == 0) ? ' grey' : '');
            });

        /* hozzáadjuk az országpatheket */
        svg.insert('g', '.boundaries').attr('class', 'countries');

        /* hozzáadjuk a jelmagyarázatot */
        makeLegend();
    };

    nviz.updateMap = function () {
        /* kiegészítjük az adatsorunkat a geo-kkal */
        const mapData = Object.keys(nviz.data.nutsData).map(function (c) {
            return {
                geo: nviz.data.nutsData[c].geo,
                e: nviz.data.nutsData[c]['e_' + nviz.CURRENTTIME],
                p: nviz.data.nutsData[c]['p_' + nviz.CURRENTTIME],
                a: nviz.data.nutsData[c]['a_' + nviz.CURRENTTIME],
                code: c,
                region: nviz.data.nutsData[c].region
            }
        });


        const average_pop = d3.mean(mapData.map(function (d) {
            return d.p;
        }));

        const average_act = d3.mean(mapData.map(function (d) {
            return d.a;
        }));

        const countries = svg.select('.countries').selectAll('.nutsrg').data(mapData, function (d) {
            return d.code;
        });

        countries.enter().append('path').on('mouseenter', function (d) {
                tooltip.select('#map-tooltip--header').text(d.region);
                tooltip.select('#map-tooltip--rate').text((d.e != null) ? (d.e + '%') : 'No data on unemployment');

                const inf = tooltip.select('#map-tooltip--info');
                inf.html('');

                if (d.p != null) {
                    inf.append('p').attr('id', 'population').html('Population: <span class="bold">' + d.p + '</span> thousand');
                    inf.append('p').html('Considered <span class="bold ' + ((d.p > average_pop) ? 'high' : 'low') + '">' +
                        ((d.p > average_pop) ? 'high' : 'low') + '</span> in Europe');
                    inf.append('p').attr('id', 'active').html('Active persons: <span class="bold">' + d.a + '</span> thousand');
                    inf.append('p').html('Considered <span class="bold ' + ((d.a > average_act) ? 'high' : 'low') + '">' +
                        ((d.a > average_act) ? 'high' : 'low') + '</span> in Europe')
                } else {
                    inf.append('p').text('No data available for population or active persons.')
                }

                const mouseCoords = d3.mouse(this);

                const w = parseInt(tooltip.style('width'));
                const h = parseInt(tooltip.style('height'));

                tooltip.style('top', (mouseCoords[1] - h / 2) + 'px');
                tooltip.style('left', (mouseCoords[0] - w / 2) + 'px');
            })
            .on('mouseout', function (d) {
                tooltip.style('left', '-9999px');
            })
            .merge(countries).attr('name', function (d) {
                return d.code
            }).attr('d', function (d) {
                return path(d.geo);
            }).attr('class', function (d) {
                if (d.e == null) {
                    return 'nodata';
                }

                return colorScale(d.e);
            }).classed('nutsrg', true);

        /* minden országpath rendelkezik egy name-el, ami a NUTS2 kódjával egyezik meg */

        countries.exit().remove();
    };
}(window.nviz = window.nviz || {}));