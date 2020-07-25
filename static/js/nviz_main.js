(function (nviz) {
    'use strict';

    /* lekérjük a statikus adatokat, majd beadjuk a ready függvénybe */
    d3.queue()
        .defer(d3.json, "static/data/nuts-data.json")
        .defer(d3.json, "static/data/nuts-map.json")
        .await(ready);

    function ready(error, nutsData, nutsMap) {
        // ha valami hiba történt az adatok beolvasása során szakítsa meg a beolvasást
        if (error) {
            return console.warn(error);
        }

        /* cache-eljük az adatokat */
        nviz.data.nutsData = nutsData;
        nviz.data.nutsMap = nutsMap;
        /* létrehozza a térképet, majd feltölti adatokkal */
        nviz.initMap();
        nviz.onDataChange();

        setTimeout(function () {
            d3.select('body').attr('class', '');
            d3.select('.overlay').attr('class', 'overlay');
        }, 2000);
    }

}(window.nviz = window.nviz || {}));