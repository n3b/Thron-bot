Timer = function()
{
    var timers = {};
    this.start = function(name){ var start = new Date().getTime(); timers[name] = start };
    this.stop = function(name) { var stop = new Date().getTime(); timers[name] = stop - timers[name]; printErr(name + ': ' + timers[name].toString()); return timers[name] };
    this.get = function(name){ return timers[name] || 0 };
    this.current = function(name){ var now = new Date().getTime(); now = now - timers[name]; return now; };
};
timer = new Timer();

Node = function(map, index)
{
    this.locked = 1;
    this.id = index;
    this.edges = 0;
    this.neighbors = [];
    this.vertex = 0;

    this.next = function(d) { return this.neighbors[d] && !this.neighbors[d].isLocked() ? this.neighbors[d] : null; }; //todo
    this.add = function(d, node) { if( this.neighbors[d] ) return; this.neighbors[d] = node; node.add(d > 1 ? d - 2 : d + 2, this); this.edges++ };
    this.lock = function(){ this.locked = 0 };
    this.unlock = function(){ this.locked = 1 };
    this.isLocked = function(){ return ! this.locked };
    this.toString = function(){return this.id};
    this.each = function(cb){ var next; for( var i = 0; i < 4; i++ ){ next = this.next(i); if( ! next ) continue; cb.call(next, i); } };
    this.isNeighbor = function(node){ for( var i in this.neighbors ) if( node === this.neighbors[i] ) return true; };
};

Map = function(b)
{
    this.width = 30;
    this.height = 20;
    var nodes = [];

    this.nodes = function(){ return nodes; };
    this.node = function(x, y){ return undefined === y ? nodes[x] : nodes[x + y * 30]; };

    for( var i = 0, p = this.width * this.height; i < p; i++ ) {
        var node = new Node(this, i);
        nodes[i] = node;
        if( i > 29 ) node.add(0, nodes[i - 30]);
        if( i % 30 > 0 ) node.add(3, nodes[i - 1]);
    };
};

Position = function(map, id)
{
    var last = [];
    var node;
    this.direction = null;
    this.id = id;
    this.target = [];

    this.set = function(x, y){ var newNode = map.node(x, y); return this.move(newNode); };
    this.move = function(newNode){ node && last.push(node); node = newNode; node.lock(); };
    this.unmove = function(){ node.unlock(); node = last.pop(); };
    this.node = function(){ return node; };
    this.clear = function(){ while(this.node()){ this.unmove() } };
    this.history = function(){ var ret = last.slice(0); ret.push(node); return ret; };
    this.next = function(d){ return node.next(d) };
    this.toString = function(){ return this.id; };
    this.moveToDirection = function(d){ var next = node.next(d); next && this.move(next); };
};

Voronoi = function(b)
{
    var available = {};
    var owned, available, target, distances, battlefront, q = [], bf, enemies, distance;

    this.calculate = function(exactPositions)
    {
        owned = [], available = {}, distances = [], enemies = {}, distance = 0;
        var next, visited = [], node, currentDistance, nextVisited, divided = null;

        var my = b.me.node(); // start from my node
        b.me.target.distance = null;
        q.push(my); owned[my] = b.me; available[b.me] = 0; distances[my] = 0;
        var positions = exactPositions ? exactPositions : b.positions;

        for( var k in b.positions ) {
            node = b.positions[k].node();
            if( owned[node] ) continue
            owned[node] = b.positions[k];
            available[b.positions[k]] = 0;
            q.push(node);
            distances[node] = 0;
        }

        while( q.length )
        {
            node = q.shift();
            var owner = owned[node];
            if( undefined  === owner ) continue;
            currentDistance = distances[node] + 1;

            node.each(function(direction)
            {
                var nextVisited = visited[this]

                if( ! nextVisited )
                {
                    visited[this] = [[owner, currentDistance]];
                    owned[this] = owner;
                    available[owner]++;
                    distances[this] = currentDistance;
                    return q.push(this);
                }

                if( 2 === nextVisited.length || owner === nextVisited[0][0] ) return;

                visited[this][1] = [owner, currentDistance];
                // select closest target
                if(b.me === owner || b.me === nextVisited[0][0] )
                {
                    var op = b.me === owner ? nextVisited[0][0] : owner;
                    enemies[op] = 1;
                    if( ! b.me.target.position ) { b.me.target.position = op; }
                    if( ! b.me.target.distance ) b.me.target.distance = 2 * nextVisited[0][1];
                }

                if( nextVisited[0][1] >= currentDistance )
                {
                    divided = b.me === owned[this];
//                    available[owned[this]]--;
                    available[owner]++;
                    delete owned[this];
                    delete distances[this];
                }
            });
        }

        if( null === b.me.target.distance ) return;

        if( b.me.node().isNeighbor(b.me.target.position.node()) )
            b.me.target.distance = 0;
        else if( null !== divided )
            divided ? b.me.target.distance-- : b.me.target.distance++;
    };

    this.owned = function(){ return owned; };
    this.available = function(player){ return available[player]; };
    this.enemies = function(){ var count = 0; for(var i in enemies) count++; return count; };
    this.distance = function() { return distance };
};

Components = function(b)
{
    var visited, spaces, num, low, vertex, current, edges;

    var calculateNeighborsDeep = function(component, node, parent)
    {
        if( visited[node] ) return;

        node.vertex = 0;
        var curnode = ++current;
        var children = 0, nodeEdges = 0, next;
        num[component][node] = low[component][node] = curnode;
        visited[node] = component;
        spaces[component]++;

        for( var i = 0; i < 4; i++ )
        {
            next = node.next(i);
            if( ! next ) continue;
            nodeEdges++;

            if( ! num[component][next] )
            {
                children++;
                calculateNeighborsDeep(component, next, node);

                if( low[component][next] >= curnode && parent ) node.vertex = 1;//vertex[component][node] = 1;
                if( low[component][next] < low[component][node] ) low[component][node] = low[component][next];
            }
            else if( num[component][next] < curnode && num[component][next] < low[component][node] )
                low[component][node] = num[component][next];
        }

        if( ! parent && children > 1 ) node.vertex = 1;//vertex[component][node] = 1;

        node.edges = nodeEdges; //todo
        edges[component] += nodeEdges;
    };

    this.calculate = function()
    {
        timer.start('components calculation');
//        for(var i in b.positions) b.positions[i].node().unlock();
        visited = [], spaces = [], num = [], low = [], vertex = [], current = 0, edges = [];
        var component = 0, next, node = b.me.node();

        for( var i = 0; i < 4; i++ )
        {
            next = node.next(i);
            if( ! next || visited[next] ) continue;

            component++;
            vertex[component] = [];
            num[component] = [];
            low[component] = [];
            edges[component] = 0;
            spaces[component] = 0;
            calculateNeighborsDeep(component, next);
        }
//        for(var i in b.positions) b.positions[i].node().lock();
        timer.stop('components calculation');
    };

    this.spaces = function(node){ return node ? (spaces[this.component(node)] || 0) : spaces; };
    this.edges = function(node){ return node ? (edges[this.component(node)] || 0) : edges; };
    this.component = function(node){ return visited[node] || 0; };
}

Strategy = function(b)
{
    var deepfill = function(node, level, parent)
    {
        var ret = 0;
        if( timer.current('turn') > 90 ) return ret;
        var best = -12, val, next, bestDirection;
        b.components.calculate();

        node.each(function(direction)
        {
            val = b.components.edges(this) - b.components.spaces(this) - 4 * this.vertex - 2 * this.edges;
            if( val > best ) { best = val; next = this; bestDirection = direction; }
        });

        if( ! next ) return ret;

        next.lock();
        var result = deepfill(node, level - 1);
        next.unlock();
        return node === parent ? [result, bestDirection] : result;
    };

    this.fill = function()
    {
        timer.start('fill');
        var result = deepfill(b.me.node(), 20, b.me.node());
        direction = undefined !== result[1] ? result[1] : null;
        timer.stop('fill');
        return direction;
    };

    this.attack = function()
    {
        var target = b.me.target.position;
        if( ! target ) return null;

        timer.start('voronoi diff attack')

        var direction = null, node = b.me.node(), node2 = target.node(), next, next2,
            best = -1000000, worst;

        node.each(function(d)
        {
            b.me.move(this);

            //todo
            if( b.getIteration() > 2 )
            {
                worst = 1000000;
                target.node().each(function()
                {
                    target.move(this);
                    b.voronoi.calculate([b.me, target]);
                    var available = b.voronoi.available(b.me) - b.voronoi.available(target);
                    target.unmove();
                    if( available < worst ) worst = available;
                });
            }
            else
            {
                b.voronoi.calculate([b.me, target]);
                worst = b.voronoi.available(b.me) - b.voronoi.available(target);
            }


            b.me.unmove();
            if( best < worst ) { best = worst; direction = d; }
        });

        timer.stop('voronoi diff attack')
        return direction;
    };
};

Board = function()
{
    this.map = new Map(this);
    this.components = new Components(this);
    this.voronoi = new Voronoi(this);
    this.strategy = new Strategy(this);

    this.positions = {};
    this.me = null;
    this.directions = ['UP', 'RIGHT', 'DOWN', 'LEFT', 'You Touch My Tralala)'];

    var iteration = 0;

    this.selectStrategy = function()
    {
        timer.start('first voronoi calculation');
        this.voronoi.calculate();
        timer.stop('first voronoi calculation');

        if( this.me.target.position )
        {
            timer.start('attack strategy');
            this.me.direction = this.strategy.attack();
            timer.stop('attack strategy');
        }

        if( null === this.me.direction ) this.me.direction = this.strategy.fill();

        if( undefined === this.directions[this.me.direction] ) this.me.direction = 4;
    };

    this.iteration = function()
    {
        iteration++;
        var first =  readline().split(' ');
        timer.start('turn');

        for( var i = 0; i < parseInt(first[0]); i++ )
        {
            var tmp = readline().split(' '), data = [];
            data[i] = [parseInt(tmp[0]), parseInt(tmp[1]), parseInt(tmp[2]), parseInt(tmp[3])]

            if( ! this.positions[i] && data[i][0] > -1 )
            {
                this.positions[i] = new Position(this.map, i);
                this.positions[i].set(data[i][0], data[i][1]);
                if( i === parseInt(first[1]) ) this.me = this.positions[i];
            }

            if( this.positions[i] )
            {
                if( data[i][2] < 0 ) { this.positions[i].clear(); delete this.positions[i]; }
                else this.positions[i].set(data[i][2], data[i][3]);
            }
        }

        this.me.target = {position: null, distance: null};
        this.me.direction = null;
        this.selectStrategy();
        print(this.directions[this.me.direction]);
        timer.stop('turn');
    };

    this.getIteration = function(){ return iteration; };
};

