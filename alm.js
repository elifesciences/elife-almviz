/**
 * ALMViz
 * See https://github.com/jalperin/almviz for more details
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @brief Article level metrics visualization controller.
 */
function AlmViz(options) {
    // Init data
    var categories_ = options.categories;
    var data = options.almStatsJson;
    var additionalStats = options.additionalStatsJson;

    // Init basic options
    var baseUrl_ = options.baseUrl;
    var hasIcon = options.hasIcon;
    var minItems_ = options.minItemsToShowGraph;
    var showTitle = options.showTitle;
    var showSources = options.showSources;
    var showSourceLinks = options.showSourceLinks;
    var chartheight = options.chartHeight;
    var chartwidth = options.chartWidth;
    var gapWidth = 2;
    var dailyNDays = 29;
    var formatNumber_ = d3.format(",d");
    var vizDiv;

    // allow jQuery object to be passed in
    // in case a different version of jQuery is needed from the one globally defined
    $ = options.jQuery || jQuery;

    if (additionalStats) {
        data[0].sources.push(additionalStats);
    }

    // Get the Div where the viz should go (default to one with ID "alm')
    if (options.vizDiv) {
        vizDiv = d3.select(options.vizDiv);
    } else {
        vizDiv = d3.select("#alm");
    }

    // extract publication date
    if (!(data && data[0])) {
        vizDiv.append("p")
            .attr("class", "muted")
            .text("Page view data not available : the server could not be contacted.")
        return this;
    }
    var pubDate = d3.time.format.iso.parse(data[0]["publication_date"]);

    // ensure there's nothing here (such as a previous graph) before we start
    vizDiv.empty();

    // look to make sure browser support SVG
    var hasSVG_ = document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1");

    // to track if any metrics have been found
    var metricsFound_;

    /**
     * Initialize the visualization.
     * NB: needs to be accessible from the outside for initialization
     */
    this.initViz = function() {
        vizDiv.select("#loading").remove();

        if (showTitle) {
            vizDiv.append("a")
                .attr('href', 'http://dx.doi.org/' + data[0].doi)
                .attr("class", "title")
                .text(data[0].title);
        }

        // loop through categories
        categories_.forEach(function(category) {
            addCategory_(vizDiv, category, data);
        });


        if (!metricsFound_) {
            vizDiv.append("p")
                .attr("class", "muted")
                .text("No metrics found.");
        }
    };


    /**
     * Build each article level statistics category.
     * @param {Object} canvas d3 element
     * @param {Array} category Information about the category.
     * @param {Object} data Statistics.
     * @return {JQueryObject|boolean}
     */
    var addCategory_ = function(canvas, category, data) {
        var $categoryRow = false;

        // Loop through sources to add statistics data to the category.
        data[0]["sources"].forEach(function(source) {
            var total = source.metrics[category.name];
            if (total > 0) {
                // Only add the category row the first time
                if (!$categoryRow) {
                    $categoryRow = getCategoryRow_(canvas, category);
                }

                // Flag that there is at least one metric
                metricsFound_ = true;
                addSource_(source, total, category, $categoryRow);
            }
        });
    };


    /**
     * Get category row d3 HTML element. It will automatically
     * add the element to the passed canvas.
     * @param {d3Object} canvas d3 HTML element
     * @param {Array} category Category information.
     * @param {d3Object}
     */
    var getCategoryRow_ = function(canvas, category) {
        var categoryRow, categoryTitle, tooltip;

        // Build category html objects.
        categoryRow = canvas.append("div")
            .attr("class", "alm-category-row")
            .attr("style", "width: 100%; overflow: hidden;")
            .attr("id", "category-" + category.name);

        categoryTitle = categoryRow.append("h2")
            .attr("class", "alm-category-row-heading")
            .attr("id", "month-" + category.name)
            .text(category.display_name);

        tooltip = categoryTitle.append("div")
            .attr("class", "alm-category-row-info").append("span")
            .attr("class", "ui-icon ui-icon-info");

        $(tooltip).tooltip({title: category.tooltip_text, container: 'body'});

        return categoryRow;
    };


    /**
     * Add source information to the passed category row element.
     * @param {Object} source
     * @param {integer} sourceTotalValue
     * @param {Object} category
     * @param {JQueryObject} $categoryRow
     * @return {JQueryObject}
     */
    var addSource_ = function(source, sourceTotalValue, category, $categoryRow) {
        var $row, $countLabel, $count,
            total = sourceTotalValue;

        $row = $categoryRow
            .append("div")
            .attr("class", "alm-row")
            .attr("style", "float: left")
            .attr("id", "alm-row-" + source.name + "-" + category.name);

        $countLabel = $row.append("div")
            .attr("class", "alm-count-label");

        if (hasIcon.indexOf(source.name) >= 0) {
            $countLabel.append("img")
                .attr("src", baseUrl_ + '/assets/' + source.name + '.png')
                .attr("alt", 'a description of the source')
                .attr("class", "label-img");
        }

        if (source.events_url) {
            // if there is an events_url, we can link to it from the count
            $count = $countLabel.append("a")
                .attr("href", function(d) { return source.events_url; });
        } else {
            // if no events_url, we just put in the count
            $count = $countLabel.append("span");
        }

        $count
            .attr("class", "alm-count")
            .attr("id", "alm-count-" + source.name + "-" + category.name)
            .text(formatNumber_(total));

        $countLabel.append("br");

        if (source.name == 'pkpTimedViews') {
            $countLabel.append("span")
                .text(source.display_name);
        } else if (showSources) {
            // link the source name
            if (showSourceLinks) {
                $countLabel.append("a")
                    .text(source.display_name);
                $countLabel.attr("href", baseUrl_ + "/sources/" + source.name)
            }
            else {
                // show the source name
                $countLabel.append("p")
                    .text(source.display_name);
            }
        }

        // Only add a chart if the browser supports SVG
        if (hasSVG_) {
            var level = false;

            // check what levels we can show
            var showDaily = false;
            var showMonthly = false;
            var showYearly = false;

            if (source.by_year) {
                levelData = getData_('year', source);
                var yearTotal = levelData.reduce(function(i, d) { return i + d[category.name]; }, 0);
                var numYears = d3.time.year.utc.range(pubDate, new Date()).length;

                if (yearTotal >= minItems_.minEventsForYearly &&
                    numYears >= minItems_.minYearsForYearly) {
                    showYearly = true;
                    level = 'year';
                }
            }

            if (source.by_month) {
                levelData = getData_('month', source);
                var monthTotal = levelData.reduce(function(i, d) { return i + d[category.name]; }, 0);
                var numMonths = d3.time.month.utc.range(pubDate, new Date()).length;

                if (monthTotal >= minItems_.minEventsForMonthly &&
                    numMonths >= minItems_.minMonthsForMonthly) {
                    showMonthly = true;
                    level = 'month';
                }
            }

            if (source.by_day){
                levelData = getData_('day', source);
                var dayTotal = levelData.reduce(function(i, d) { return i + d[category.name]; }, 0);
                var numDays = d3.time.day.utc.range(pubDate, new Date()).length;

                if (dayTotal >= minItems_.minEventsForDaily && numDays >= minItems_.minDaysForDaily) {
                    showDaily = true;
                    level = 'day';
                }
            }

            // The level and levelData should be set to the finest level
            // of granularity that we can show

            // check there is data
            if (showDaily || showMonthly || showYearly) {
                var $chartDiv = $row.append("div")
                    .attr("class", "alm-chart-area");

                var viz = getViz_($chartDiv, source, category);
                loadData_(viz, level);

                var update_controls = function(control) {
                    control.siblings('.alm-control').removeClass('active');
                    control.addClass('active');
                };

                var $levelControlsDiv = $chartDiv.append("div")
                    .attr("style", "width: " + (viz.margin.left + viz.width) + "px;")
                    .append("div")
                    .attr("style", "float:right;");

                // only show the control if there are at least 2 options
                if (showDaily && (showMonthly||showYearly)) {
                    $levelControlsDiv.append("a")
                        .attr("href", "javascript:void(0)")
                        .classed("alm-control", true)
                        .classed("disabled", !showDaily)
                        .classed("active", (level == 'day'))
                        .text("daily (first 30)")
                        .on("click", function() {
                            if (showDaily &&
                                !$(this).hasClass('active')) {
                                loadData_(viz, 'day');
                                update_controls($(this));
                            }
                        }
                    );
                    $levelControlsDiv.append("text")
                        .text(" | ");
                }

                if (showMonthly && (showDaily||showYearly)) {
                    $levelControlsDiv.append("a")
                        .attr("href", "javascript:void(0)")
                        .classed("alm-control", true)
                        .classed("disabled", !showMonthly)
                        .classed("active", (level == 'month'))
                        .text("monthly")
                        .on("click", function() {
                            if (showMonthly &&
                                !$(this).hasClass('active')) {
                                loadData_(viz, 'month');
                                update_controls($(this));
                            }
                        }
                    );

                    if (showYearly) {
                        $levelControlsDiv.append("text")
                            .text(" | ");
                    }
                }

                if (showYearly && (showMonthly||showDaily)) {
                    $levelControlsDiv.append("a")
                        .attr("href", "javascript:void(0)")
                        .classed("alm-control", true)
                        .classed("disabled", !showYearly)
                        .classed("active", (level == 'year'))
                        .text("yearly")
                        .on("click", function() {
                            if (showYearly &&
                                !$(this).hasClass('active')) {
                                loadData_(viz, 'year');
                                update_controls($(this));
                            }
                        }
                    );
                }

                // add a clearer and styles to ensure graphs on their own line
                $row.insert("div", ":first-child")
                    .attr('style', 'clear:both');
                $row.attr('style', "width: 100%");
            };
        };

        return $row;
    };


    /**
     * Extract the date from the source
     * @param level (day|month|year)
     * @param d the datum
     * @return {Date}
     */
    var getDate_ = function(level, d) {
        switch (level) {
            case 'year':
                return new Date(d.year, 0, 1, 12, 0);
            case 'month':
                // js Date indexes months at 0
                return new Date(d.year, d.month - 1, 1, 12, 0);
            case 'day':
                // js Date indexes months at 0
                return new Date(d.year, d.month - 1, d.day, 12, 0);
            default:
                return new Date(d.year, d.month - 1, d.day, 12, 0);
        }
    };


    /**
     * Returns a d3 date format for date operations.
     *
     * @param level (day|month|year)
     * @param d the datum
     * @return {String}
     */
    var getDateFormat_ = function(level) {
        switch (level) {
            case 'year':
                return d3.time.format("%Y");
            case 'month':
                return d3.time.format("%b %y");
            case 'day':
                return d3.time.format("%d %b %y");
            default:
                return d3.time.format("%d %b %y");
        }
    };


    /**
     * Extract the data from the source.
     *
     * @param {string} level (day|month|year)
     * @param {Object} source
     * @return {Array} Metrics
     */
    var getData_ = function(level, source) {
        switch (level) {
            case 'year':
                return source.by_year;
            case 'month':
                return source.by_month;
            case 'day':
                return source.by_day;
            default:
                return [];
        }
    };

    /**
     * Returns a d3 date object for date operations.
     *
     * @param {string} level (day|month|year
     * @return {Object} d3 time Interval
     */
    var getTimeInterval_ = function(level) {
        switch (level) {
            case 'year':
                return d3.time.year.utc;
            case 'month':
                return d3.time.month.utc;
            case 'day':
                return d3.time.day.utc;
        }
    };

    /**
     * The basic general set up of the graph itself
     *
     * @param {JQueryElement} chartDiv The div where the chart should go
     * @param {Object} source
     * @param {Array} category The category for 86 chart
     * @return {Object}
     */
    var getViz_ = function(chartDiv, source, category) {
        var viz = {};

        // size parameters
        viz.margin = {top: 5, right: 5, bottom: 30, left: 40};
        viz.width = chartwidth - viz.margin.left - viz.margin.right;
        viz.height = chartheight - viz.margin.top - viz.margin.bottom;

        // div where everything goes
        viz.chartDiv = chartDiv;

        // source data and which category
        viz.category = category;
        viz.source = source;

        // just for record keeping
        viz.name = source.name + '-' + category.name;

        viz.x = d3.time.scale();
        viz.x.range([0, viz.width]);

        viz.y = d3.scale.linear();
        viz.y.range([viz.height, 0]);

        viz.z = d3.scale.ordinal();
        viz.z.range(['main', 'alt']);

        // The chart SVG element.
        viz.svg = viz.chartDiv.append("svg")
            .attr("width", viz.width + viz.margin.left + viz.margin.right)
            .attr("height", viz.height + viz.margin.top + viz.margin.bottom)
            // create a transformed group for the data area
            .append("g")
            .attr("transform", "translate(" + (viz.margin.left) + "," + (viz.margin.top) + ")");

        // draw the bars g first so it ends up underneath the axes
        viz.bars = viz.svg.append("g");

        // and the shadow bars on top for the tooltips
        viz.barsForTooltips = viz.svg.append("g");

        // now the x and y axis bars.
        viz.svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + (viz.height) + ")");

        // now the x and y axis bars.
        viz.svg.append("g")
            .attr("class", "y axis");

        return viz;
    };


    /**
     * Takes in the basic set up of a graph and loads the data itself
     * @param {Object} viz AlmViz object
     * @param {string} level (day|month|year)
     */
    var loadData_ = function(viz, level) {
        var category = viz.category;
        var levelData = getData_(level, viz.source);
        var timeInterval = getTimeInterval_(level);

        var endDate = new Date();
        // use only first N days if using day view
        if (level == 'day') {
            endDate = timeInterval.offset(pubDate, dailyNDays);
        }

        //
        // Domains for x and y
        //
        // a time x axis, between pubDate and endDate
        // floor() here rounds down to the previous day, month or
        // year interval (see getTimeInterval_())
        xdom = [timeInterval.floor(pubDate), endDate];
        console.log("xdomain: [" + xdom[0] + ", " + xdom[1] + "]");
        viz.x.domain(xdom);

        // a linear axis from 0 to max value found
        viz.y.domain([0, d3.max(levelData, function(d) {
            return d[category.name];
        })]);

        //
        // Axis
        //
        // a linear axis between publication date and current date
        viz.xAxis = d3.svg.axis()
            .scale(viz.x)
            .tickSize(4)
            .ticks(5)
            .tickFormat(getDateFormat_(level));

        // a linear y axis between 0 and max value found in data
        viz.yAxis = d3.svg.axis()
            .scale(viz.y)
            .orient("left")
            .tickSize(4)
            .ticks(4)
            .tickFormat(d3.format(",d"));

        //
        // The chart itself
        var datasetLen = (timeInterval.range(pubDate, endDate).length);

        // the min of 1 ensures we get something visible...
        var barWidth = Math.max(( viz.width / datasetLen ) - gapWidth, 1);

        // Account for the 30-day view
        var filteredLevelData = levelData.filter(function (d) {
                var dt = getDate_(level, d);
                return (dt >= pubDate) && (dt < endDate);
            }
        );

        var barClasses = function (d) {
            var tmClass = (level == 'day') ?
                d3.time.weekOfYear(getDate_(level, d)) :
                d.year;
            // z(tmClass) is 'main' or 'alt' : see z.range
            return "bar " + viz.z(tmClass);
        };

        var barXPos = function(d) {
            var dt = getDate_(level, d);
            var c = viz.x(dt);
            return c - barWidth/2;
        };

        var barYPos = function (d) {
            return viz.y(d[category.name]);
        };

        // The bars to which tooltips are attached are separate from the visible ones.
        var barsForTooltips = viz.barsForTooltips.selectAll(".barsForTooltip")
            .data(filteredLevelData, function (d) {
                return getDate_(level, d);
            }
        );

        barsForTooltips
            .exit()
            .remove();

        var bars = viz.bars.selectAll(".bar")
            .data(filteredLevelData, function (d) {
                return getDate_(level, d);
            });

        bars
            .enter()
            .append("rect")
            .attr("width", barWidth)
            .attr("height", 0)
            .attr("x", barXPos)
            .attr("y", viz.height)
            .attr("class", barClasses);

        // TODO: these transitions could use a little work
        bars.transition()
            .duration(1000)
            .attr("width", barWidth)
            .attr("y", barYPos)
            .attr("height", function(d) { return viz.height - viz.y(d[category.name]); });

        bars
            .exit().transition()
            .attr("y", viz.height)
            .attr("height", 0);

        bars
            .exit()
            .remove();

        viz.svg
            .select(".x.axis")
            .call(viz.xAxis);

        viz.svg
            .transition().duration(1000)
            .select(".y.axis")
            .call(viz.yAxis);

        barsForTooltips
            .enter().append("rect")
            .attr("class", function(d) { return "barsForTooltip " + viz.z((level == 'day' ? d3.time.weekOfYear(getDate_(level, d)) : d.year)); });

        barsForTooltips
            .attr("width", barWidth)
            .attr("x", barXPos)
            // '- 1' here means there's a 1px gap between top of bar and arrow of tooltip, which
            // looks better.
            .attr("y", barYPos)
            .attr("height", function(d) { return viz.height - viz.y(d[category.name]) + 1; });

        // add in some tool tips
        viz.barsForTooltips.selectAll("rect").each(
            function(d,i){
                $(this).tooltip('destroy'); // need to destroy so all bars get updated
                $(this).tooltip({title: formatNumber_(d[category.name]), container: "body"});
            }
        );
    }
}
