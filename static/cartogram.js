var mapdiv = d3.select("#mapdiv")

var width = parseInt(mapdiv.style("width")) - 120,
	height = parseInt(mapdiv.style("height")) - 40;

var proj = d3.geo.mercator()
	.center([-121.33, 47.9])
	.scale(10000);

var zoom = d3.behavior.zoom()
	.translate(proj.translate())
	.scale(proj.scale())
	.scaleExtent([10000,80000]);

var svg = mapdiv
	.append("svg")
	.attr("width", width)
	.attr("height", height)
	.append("g")
	.attr("id", "mapsvg");

var map_g = svg.append("g");
	
svg.append("rect")
	.attr("class", "overlay")
	.attr("width", width)
	.attr("height", height)
	.style("stroke", "black");

svg.call(zoom)
	.call(zoom.event);


d3.json("https://gist.githubusercontent.com/mbostock/4090846/raw/d534aba169207548a8a3d670c9c2cc719ff05c47/us.json",
	function(us)
	{
		console.log(us);
		//Draw background map
		var geo_path = d3.geo.path()
			.projection(proj);
		var counties = svg.append("g")
			.attr("class", "counties")
			.selectAll("path")
			.data(topojson.feature(us, us.objects.counties).features
				// Only draw Washington counties
				.filter(function(d) { return d.id.toString().slice(0,2) == "53"; }))
			.enter().append("path")
				.attr("d", geo_path);
d3.json("/data",
	function(data)
	{
		var flow_scale = d3.scale.ordinal()
			.domain(d3.range(6))
			//.range([1, 1, 1.5, 2, 3, 1]);
			.range([1,1,1.5,3,4,1]);
		var road_color_scale = d3.scale.category10()
			.domain(["NB", "SB", "EB", "WB"]);
		//Some data points have improper lat/long.
		//Also, it's convenient to store the index here
		data = data.filter(function(d) { return d.FlowStationLocation.Longitude != 0; });
		
		//Create two copies of every flow station: one to be held in place, and the other (visible) to be forced according to traffic
		//The two nodes will be linked together
		var fixed_nodes = data.map(function(d, i)
			{
				return {"x":d.FlowStationLocation.Longitude, "y":d.FlowStationLocation.Latitude, "fixed":true, "flow": d};
			});
		var forced_nodes = data.map(function(d, i)
			{
				return {"x":d.FlowStationLocation.Longitude, "y":d.FlowStationLocation.Latitude, "fixed":false, "flow": d};
			});
		var roadnest = d3.nest()
			.key(function(d) {return d.flow.FlowStationLocation.Direction + d.flow.FlowStationLocation.RoadName;})
			.sortValues(function(a, b) {return a.flow.FlowStationLocation.MilePost - b.flow.FlowStationLocation.MilePost;})
			.entries(forced_nodes);		
			
		var nodes = forced_nodes.concat(fixed_nodes);
		
		//Create links between the two nodes for each station
		var links = forced_nodes.map(function(d, i)
			{
				return {"source":i, "target":i+forced_nodes.length, "dist":0};
			});
				
		//Create links between adjacent nodes
		roadnest.forEach(function(road)
			{
				road.values.forEach(function(d, i)
					{
						if (i+1 < road.values.length)
						{
							links.push({"source":d,
								"target":road.values[i+1],
								"dist":flow_scale(d.flow.FlowReadingValue)*flow_station_dist(d.flow, road.values[i+1].flow)});
						}
					});
			});
				
		var force = d3.layout.force()
			.charge(0) //Don't care about nodes overlapping
			.gravity(0) //Nodes are held close to their starts already
			.nodes(nodes)
			.links(links)
			.linkDistance(function(d) {return d.dist;})
			.on("tick", ticked)
			.start();
			
		var road_path = d3.svg.line()
			.x(function(d) { return proj([d.x, d.y])[0]; })
			.y(function(d) { return proj([d.x, d.y])[1]; })
			.interpolate("linear");

		var roads = map_g.selectAll(".road") //Draw a line for each road link
			.data(roadnest)
			.enter()
			.append("path")
				.attr("class", function(d) { return "road " + d.values[0].flow.FlowStationLocation.Direction; })
				.style("stroke", function(d) {return road_color_scale(d.values[0].flow.FlowStationLocation.Direction); })
				.attr("d", function(d) { return road_path(d.values); });

		/*var stations = map_g.selectAll("circle")
			.data(forced_nodes)
			.enter()
			.append("circle")
				.attr("class", function(d) {return "station val" + d.flow.FlowReadingValue;})
				.attr("r", function(d) {return flow_scale(d.flow.FlowReadingValue);})
				.attr("cx", function(d) { return proj([d.x, d.y])[0]; })
				.attr("cy", function(d) { return proj([d.x, d.y])[1]; });*/
		zoom.on("zoom", zoomed);
		function ticked()
		{
			roads.attr("d", function(d) { return road_path(d.values); });
			/*stations.attr("cx", function(d) { return proj([d.x, d.y])[0]; })
				.attr("cy", function(d) { return proj([d.x, d.y])[1]; });*/
		}
		function zoomed()
		{
			proj.translate(d3.event.translate).scale(d3.event.scale);
			counties.attr("d", geo_path);
			ticked();
		}
		function flow_station_dist(a, b)
		{
			return Math.sqrt(
				Math.pow(a.FlowStationLocation.Longitude-b.FlowStationLocation.Longitude,2) +
				Math.pow(a.FlowStationLocation.Latitude-b.FlowStationLocation.Latitude,2));
		}
		
		function newflowdata(data)
		{
			data = data.filter(function(d) { return d.FlowStationLocation.Longitude != 0; });
			// Nodes might be different each time, not sure why but we'll
			// try to match nodes using FlowDataID which uniquely identifies stations
			// Data is always sorted on this
			for (var i = 0, j = 0; j < data.length; )
			{
				if (i > forced_nodes.length)
				{
					//More nodes than before, append
					forced_nodes.push({"x":data[j].FlowStationLocation.Longitude,
									   "y":data[j].FlowStationLocation.Latitude,
									   "fixed":false,
									   "flow": data[j]});
					fixed_nodes.push({"x":data[j].FlowStationLocation.Longitude,
									   "y":data[j].FlowStationLocation.Latitude,
									   "fixed":true,
									   "flow": data[j]});
					i++;
					j++;
				} else if (data[j].FlowDataID > forced_nodes[i].flow.FlowDataID)
				{
					// A node disappeared
					forced_nodes.splice(i, 1);
					fixed_nodes.splice(i, 1);
				} else if (data[j].FlowDataID < forced_nodes[i].flow.FlowDataID)
				{
					// A new node appeared
					forced_nodes.splice(i, 0, {"x":data[j].FlowStationLocation.Longitude,
									   "y":data[j].FlowStationLocation.Latitude,
									   "fixed":false,
									   "flow": data[j]});
					fixed_nodes.splice(i, 0, {"x":data[j].FlowStationLocation.Longitude,
									   "y":data[j].FlowStationLocation.Latitude,
									   "fixed":true,
									   "flow": data[j]});
					i++;
					j++;
				} else {
					//Match! Replace.
					forced_nodes[i].flow = data[j];
					i++;
					j++;
				}
			}
			
		//regenerate nest and links
		roadnest = d3.nest()
			.key(function(d) {return d.flow.FlowStationLocation.Direction + d.flow.FlowStationLocation.RoadName;})
			.sortValues(function(a, b) {return a.flow.FlowStationLocation.MilePost - b.flow.FlowStationLocation.MilePost;})
			.entries(forced_nodes);		
			
		nodes = forced_nodes.concat(fixed_nodes);
		
		//Create links between the two nodes for each station
		links = forced_nodes.map(function(d, i)
			{
				return {"source":i, "target":i+forced_nodes.length, "dist":0};
			});
				
		//Create links between adjacent nodes
		roadnest.forEach(function(road)
			{
				road.values.forEach(function(d, i)
					{
						if (i+1 < road.values.length)
						{
							links.push({"source":d,
								"target":road.values[i+1],
								"dist":flow_scale(d.flow.FlowReadingValue)*flow_station_dist(d.flow, road.values[i+1].flow)});
						}
					});
			});
			force.nodes(nodes)
				.links(links)
				.linkDistance(function(d) { return d.dist; })
				.start();
		}
	});
			
	});