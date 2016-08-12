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
    this.x = index % 30;
    this.y = Math.floor(index / 30);
    this.edges = 0;
    this.neighbors = [];
    this.vertex = 0;
    this.owned = null;

    this.next = function(d) { return this.neighbors[d] && !this.neighbors[d].isLocked() ? this.neighbors[d] : null; }; //todo
    this.add = function(d, node) { if( this.neighbors[d] ) return; this.neighbors[d] = node; node.add(d > 1 ? d - 2 : d + 2, this); this.edges++ };
    this.lock = function(){ this.locked = 0; map.locked++; };
    this.unlock = function(){ this.locked = 1; map.locked--; };
    this.isLocked = function(){ return ! this.locked };
    this.toString = function(){return this.id};
    this.each = function(cb){ var next; for( var i = 0; i < 4; i++ ){ next = this.next(i); if( ! next ) continue; cb.call(next, i); } };
    this.isNeighbor = function(node){ for( var i in this.neighbors ) if( node === this.neighbors[i] ) return true; };
};

Map = function(b)
{
    this.width = 30;
    this.height = 20;
    this.locked = 0;
    this.total = 0;
    var nodes = [];

    this.nodes = function(){ return nodes; };
    this.node = function(x, y){return undefined === y ? nodes[x] : (x >= 0 && x <= 29 && y >= 0 && y <= 19 ? nodes[x + y * 30] : null); };
    this.neighbors = function(node) { var x = node.x, y = node.y; return [this.node(x-1, y-1), this.node(x, y-1), this.node(x+1, y-1), this.node(x+1, y), this.node(x+1, y+1), this.node(x, y+1), this.node(x-1, y+1), this.node(x-1, y)] };
    this.isPossibleCutVertex = function(node){
        var trigger = null, current = null, points = 0;
        var neighbors = this.neighbors(node);
        for( var i in neighbors ) {
            current = neighbors[i] ? ! neighbors[i].isLocked() : false;
            if( trigger !== current ) { trigger = current; points++; }
        }
        printErr('articulation points ', points);
        return points >= 4;
    };

    for( var i = 0, p = this.width * this.height; i < p; i++ ) {
        var node = new Node(this, i);
        nodes[i] = node;
        if( i > 29 ) node.add(0, nodes[i - 30]);
        if( i % 30 > 0 ) node.add(3, nodes[i - 1]);
        this.total++;
    };
};

Position = function(map, id)
{
    var last = [];
    var node;
    this.direction = null;
    this.id = id;
    this.target = null;
    this.distance = null;

    this.set = function(x, y){ var newNode = map.node(x, y); return this.move(newNode); };
    this.move = function(newNode){node && last.push(node); node = newNode; node.lock(); node.owned = this; node.each(function(){this.edges--;}); };
    this.unmove = function(){ node.unlock(); node.owned = null; node.each(function(){this.edges++;}); node = last.pop(); };
    this.node = function(){ return node; };
    this.clear = function(){ while(this.node()){ this.unmove() } };
    this.history = function(){ var ret = last.slice(0); ret.push(node); return ret; };
    this.next = function(d){ return node.next(d) };
    this.toString = function(){ return this.id; };
    this.moveToDirection = function(d){ var next = node.next(d); next && this.move(next); };
};

Voronoi = function(b)
{
    var owned, available, distances, q = [], enemies;

    this.calculate = function(exactPositions)
    {
        owned = [], available = {}, distances = [], enemies = {};
        var node, currentDistance;
        b.me.target = null;
        node = b.me.node(); // start from my node

        q.push(node); available[b.me] = 0; distances[node] = 0;
        var positions = exactPositions ? exactPositions : b.positions;

        for( var k in b.positions )
        {
            node = positions[k].node();
            owned[node] = positions[k];
            if( b.me === positions[k] ) continue
            if( b.me.node().isNeighbor(positions[k].node()) ) positions[k].distance = 0;
            else positions[k].distance = null;
            available[positions[k]] = 0;
            distances[node] = 0;
            q.push(node);
        }

        while( q.length )
        {
            node = q.shift();
            var owner = owned[node];
            node.owned = owner;
            currentDistance = distances[node] + 1;

            node.each(function()
            {
                var nextNodeOwner = owned[this];
                if( ! nextNodeOwner )
                {
                    available[owner]++;
                    distances[this] = currentDistance;
                    owned[this] = owner;
                    return q.push(this);
                }

                if( owner === nextNodeOwner || (b.me !== owner && b.me !== nextNodeOwner) ) return;

                var enemy = b.me === owner ? nextNodeOwner : owner;
                enemies[enemy] = 1;
                if( null === enemy.distance ) {
                    enemy.distance = distances[this] + distances[node];
                }
            });
        }

        var distance = 1000;
        for( var k in positions )
        {
            if( null !== positions[k].distance && distance > positions[k].distance ) {
                b.me.target = positions[k]; distance = positions[k].distance;
            }
        }
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

    this.calculateMovesFrom = function(node)
    {
        var _q = [], checked = [], points = [], enemies = [], enemiesCount = [];
        node.each(function(d){_q.push(this);this.fromDirection = d;points[d] = 0; enemiesCount[d] = 0; enemies[d] = []});

        while( _q.length )
        {
            node = _q.shift();
            if( node.owned && node.owned !== b.me ) {
                if( ! enemies[node.fromDirection][node.owned] ) {
                    enemies[node.fromDirection][node.owned] = 1;
                    enemiesCount[node.fromDirection]++;
                }
                continue;
            }

            node.each(function(direction)
            {
                if( checked[this] ) return;
                checked[this] = 1;
                this.fromDirection = node.fromDirection;
                _q.push(this);
            });

            points[node.fromDirection] += node.edges;
        }

        return points;
    };

    this.spaces = function(node){ return node ? (spaces[this.component(node)] || 0) : spaces; };
    this.edges = function(node){ return node ? (edges[this.component(node)] || 0) : edges; };
    this.component = function(node){ return visited[node] || 0; };
};

Strategy = function(b)
{
    var deepfill = function(node, level, parent)
    {
        var ret = 0;
        if( timer.current('turn') > 90 ) return ret;
        var best = -10000, val, next, bestDirection;
        b.components.calculate();

        node.each(function(direction)
        {
            val = b.components.edges(this) - b.components.spaces(this) - 4 * b.map.isPossibleCutVertex(this) - 2 * this.edges;
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
        var result = deepfill(b.me.node(), 10, b.me.node());
        direction = undefined !== result[1] ? result[1] : null;
        timer.stop('fill');
        return direction;
    };

    this.attack = function()
    {
        timer.start('voronoi diff attack')
        if( ! b.me.target ) return null;
        var target = b.me.target;

        var direction = null, node = b.me.node(), best = -1000000, worst;
        var distance = target.distance;
        var changeStrategyDistance = 2;

        node.each(function(d)
        {
            b.me.move(this);

            worst = 1000000;
            var lose = false;
            if( distance > changeStrategyDistance )
            {
                b.voronoi.calculate();
                worst = b.voronoi.available(b.me) - b.voronoi.available(target) - 100* target.distance - 20 * this.edges;
            }
            else
            {
                target.node().each(function()
                {
                    target.move(this);
                    b.voronoi.calculate();
                    var myspace = b.voronoi.available(b.me), enemyspace = b.voronoi.available(target);
                    var available = myspace - enemyspace - 4 * target.distance;
                    if( myspace / enemyspace < 0.2 ) lose = true;

                    printErr('available: ', b.directions[d], available);
                    target.unmove();
                    if( available < worst && ! lose ) worst = available;
                });

//                if( ! lose )
//                    worst += - this.edges - b.me.target.distance;
            }

            b.me.unmove();

            if( best < worst && ! lose ) { best = worst; direction = d; }
        });

        timer.stop('voronoi diff attack')
        return direction;
    };

    this.changeDirection = function()
    {
        timer.start('changing direction');
        var best = -10000, direction = null, node = b.me.node(), val;

        node.each(function(d)
        {
            b.me.move(this);

            var worst = 10000;

            if(b.me.target)
            {
                var target = b.me.target;
                printErr('target ', target.id);

                target.node().each(function(){
                    target.move(this);
                    b.voronoi.calculate();
                    val = b.voronoi.available(b.me);
                    target.unmove();
                });

                if( val < worst ) worst = val;

            } else {
                b.voronoi.calculate();
                val = b.voronoi.available(b.me);
                if( val < worst ) worst = val;
            }

            b.me.unmove();

            if( best < worst ) { best = worst; direction = d; }
        });

        timer.stop('changing direction');
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
    this.activePlayers = 0;
    this.me = null;
    this.directions = ['UP', 'RIGHT', 'DOWN', 'LEFT', 'You Touch My Tralala)'];
    this.mode = null;

    var iteration = 0;

    this.selectStrategy = function()
    {
        timer.start('first calculation');
        this.voronoi.calculate();
        this.me.node().unlock();
        this.components.calculate();
        this.me.node().lock();
        timer.stop('first calculation');

        if( this.map.isPossibleCutVertex(this.me.node()) ) {
            this.me.direction = this.strategy.changeDirection();
        }
        else if( this.me.target && ! this.mode )
        {
            timer.start('attack strategy');
            this.me.direction = this.strategy.attack();
            timer.stop('attack strategy');
        }

        if( 'fill' === this.mode || null === this.me.direction ) this.me.direction = this.strategy.fill();

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
                this.activePlayers++;
            }

            if( this.positions[i] )
            {
                if( data[i][2] < 0 ) { this.positions[i].clear(); delete this.positions[i]; this.activePlayers--; }
                else this.positions[i].set(data[i][2], data[i][3]);
            }
        }

        this.me.target = null;
        this.me.direction = null;
        this.selectStrategy();
        print(this.directions[this.me.direction]);
        timer.stop('turn');
    };

    this.getIteration = function(){ return iteration; };
};

