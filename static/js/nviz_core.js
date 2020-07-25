(function (nviz) {
    /* adattároló */
    nviz.data = {}
    nviz.CURRENTTIME = 2019;

    nviz.onDataChange = function () {
        nviz.updateMap();
    }

} (window.nviz = window.nviz || {}));