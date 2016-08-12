const MAXVAL = 1000000; const MINVAL = -1000000;
Timer = function()
{
    var timers = {};
    this.start = function(name){ timers[name] = new Date().getTime(); };
    this.stop = function(name) { var stop = new Date().getTime(); timers[name] = stop - timers[name]; printErr(name + ': ' + timers[name].toString()); return timers[name] };
    this.get = function(name){ return timers[name] || 0 };
    this.current = function(name){ var now = new Date().getTime(); return now - timers[name]; };
};
timer = new Timer();

Position = function(map, id)
{
    var last = [];
    var node;
    this.direction = null;
    this.id = id;

    this.set = function(x, y){ var newNode = map.node(x, y); return this.move(newNode); };
    this.move = function(newNode){node && last.push(node); node = newNode; node.lock(); map.lock(node, this); node.owner = this; /*node.each(function(){this.edges--;});*/ };
    this.unmove = function(){ node.unlock(); map.unlock(node); node.owner = null; /*node.each(function(){this.edges++;});*/ node = last.pop(); };
    this.node = function(){ return node; };
    this.clear = function(){ while(this.node()){ this.unmove() } };
    this.history = function(){ var ret = last.slice(0); ret.push(node); return ret; };
    this.next = function(d){ return node.next(d) };
    this.toString = function(){ return this.id; };
    this.moveToDirection = function(d){ var next = node.next(d); next && this.move(next); };
};

Collection = function()
{
    var e = {}, count = 0;
    this.set = function(key, value){ e[key] = value; count++; };
    this.get = function(key, _default){ return undefined !== e[key] ? e[key] : _default; };
    this.has = function(key){ return undefined !== e[key]; };
    this.count = function(){ return count; };
    this.del = function(key){ delete e[key]; count--; };
};

Node = function(map, index)
{
    this.locked = 1;
    this.id = index;
    this.x = index % 30;
    this.y = Math.floor(index / 30);
    this.edges = 0;
    this.neighbors = [];
    this.vertex = 0;
    this.owner = null;

    this.next = function(d) { return this.neighbors[d] && !this.neighbors[d].isLocked() ? this.neighbors[d] : null; }; //todo
    this.add = function(d, node) { if( this.neighbors[d] ) return; this.neighbors[d] = node; node.add(d > 1 ? d - 2 : d + 2, this); this.edges++ };
    this.lock = function(){ this.locked = 0; };
    this.unlock = function(){ this.locked = 1; };
    this.isLocked = function(){ return ! this.locked };
    this.toString = function(){return this.id};
    this.each = function(cb){ var next; for( var i = 0; i < 4; i++ ){ next = this.next(i); if( ! next ) continue; cb.call(next, i); } };
    this.each2 = function(cb){ var next; for( var i = 0; i < 4; i++ ){ next = this.neighbors[i]; if( ! next ) continue; cb.call(next, i); } };
    this.isNeighbor = function(node){ for( var i in this.neighbors ) if( node === this.neighbors[i] ) return true; };
};

Component = function(id, componentsStack, nodesStack)
{
    this.id = id;
    this.available = 0;
    this.edges = 0;
    this.nodes = [];
    this.exits = [];
    this.neighbors = [];
    this.traversable = null;
    this.toString = function(){return this.id};

    this.merge = function(component)
    {
        for( var i in component.nodes )
        {
            this.nodes[i] = component.nodes[i];
            nodesStack[i] = this;
        }

        for( var i in component.exits ) this.exits[i] = component.exits[i];
        this.available += component.available;
        this.edges += component.edges;
        delete componentsStack[component];

        for( var i in component.neighbors )
        {
            var otherComponent = component.neighbors[i];
            this.addNeighbor(otherComponent);
            delete component.neighbors[otherComponent.id];
            delete otherComponent.neighbors[component.id];
        }

        return this;
    };

    this.addNode = function(node)
    {
        this.nodes[node.id] = node;
        this.available++;
        this.edges += b.map.edges(node);
        nodesStack[node.id] = this;
        return this;
    };

    this.isSame = function(node)
    {
        var c = nodesStack[node];
        if( c.available > 0 ) return this === c;
        var same = false, that = this;
        node.each(function(){ if( nodesStack[this] === that ) same = true; });
        return same;
    };

    this.addNeighbor = function(component)
    {
        if( this !== component ) { component.neighbors[this.id] = this; this.neighbors[component.id] = component; }
    };

    this.maxTraversableSpace = function(visited)
    {
        if( null !== this.traversable ) return this.traversable;
        if( ! visited ) visited = [];
        if( visited[this.id] ) return 0;
        visited[this.id] = this;
        var traversable = this.available, childTraversable = 0;
        for( var i in this.neighbors )
            childTraversable = Math.max(this.traversable, this.neighbors[i].maxTraversableSpace(visited));
        traversable += childTraversable;
        return this.traversable = traversable;
    };

    componentsStack && (componentsStack[this] = this);
};

VoronoiRegion = function(position, ownedStack, voronoiStack)
{
    this.position = position;
    this.distances = [];
    this.nodes = [];
    this.toString = function(){ return position.id };
    this.available = 0;

    this.addNode = function(parent, node)
    {
        ownedStack[node.id] = this;
        this.distances[node.id] = parent ? this.distances[parent.id] + 1 : 0;
        this.nodes[node.id] = node;
        this.available++;

        return this;
    };

    voronoiStack && (voronoiStack[position.id] = this);
}

Evaluation = function(evaluateComponents, evaluateVoronoi)
{
//    timer.start('evaluation');

    var q = [], nodesStack = [], componentsStack = [], voronoiStack = [], ownedStack = [], componentId = 0,
        neighbors = [], distances = [], isVertex, node;
    if( undefined === evaluateComponents ) evaluateComponents = true;
    if( undefined === evaluateVoronoi ) evaluateVoronoi = true;

    // my turn
    new Component(++componentId, componentsStack, nodesStack).addNode(b.me.node()).available = 0;
    new VoronoiRegion(b.me, ownedStack, voronoiStack).addNode(null, b.me.node(), 0);
    q.push(b.me.node());

    for( var i in b.positions )
    {
        if( b.me === b.positions[i] ) continue;
        new Component(++componentId, componentsStack, nodesStack).addNode(b.positions[i].node()).available = 0;
        new VoronoiRegion(b.positions[i], ownedStack, voronoiStack).addNode(null, b.positions[i].node());
        distances[b.positions[i]] = null;
        q.push(b.positions[i].node());
    }

    while(node = q.shift())
    {
        var currentComponent = nodesStack[node.id], voronoi = ownedStack[node.id];
        isVertex = b.map.isPossibleCutVertex(node);

        node.each(function(d)
        {
            var nextNodeVoronoi = ownedStack[this.id];

            if( evaluateVoronoi )
            {
                // next is empty
                if( ! nextNodeVoronoi )
                {
                    voronoi.addNode(node, this);
                    if( ! evaluateComponents ) q.push(this);
                }
                else if( voronoi !== nextNodeVoronoi && ( b.me === voronoi.position || b.me === nextNodeVoronoi.position ) )
                {
                    // next is neighbor of mine, calc distance
                    var enemyVoronoiRegion = b.me === voronoi.position ? nextNodeVoronoi : voronoi;
                    if( null === distances[enemyVoronoiRegion.position.id] )
                    {
                        distances[enemyVoronoiRegion.position.id] = voronoi.distances[node.id] + nextNodeVoronoi.distances[this.id];
                        neighbors[enemyVoronoiRegion.position.id] = enemyVoronoiRegion.position;
                    }
                }
            }

            if( evaluateComponents )
            {
                // visited
                if( nodesStack[this.id] )
                {
                    // same component
                    if( nodesStack[this.id] !== currentComponent && ! (isVertex && b.map.isPossibleCutVertex(this)) )
                        currentComponent.merge(nodesStack[this.id]);
                    return;
                }

                if( isVertex )
                {
                    currentComponent.exits[node.id] = node
                    currentComponent.addNeighbor(new Component(++componentId, componentsStack, nodesStack).addNode(this));
                }
                else currentComponent.addNode(this);

                q.push(this);
            }
        });
    }

//    timer.stop('evaluation');

    this.owned = function(node){ return node ? ownedStack[node.id] : ownedStack; };
    this.voronoi = function(position){ return voronoiStack[position.id]; };
    this.distance = function(position){ return position ? distances[position.id] : distances; };
    this.component = function(node){ return node ? nodesStack[node.id] : componentsStack; };
    this.neighbors = function(){ return neighbors; };
    this.closest = function()
    {
        var distance = null, closest = null;
        for( var i in distances )
            if( null === distance || distance < distances[i] ) { distance = distances[i]; closest = neighbors[i]; }
        return closest;
    };
};

Map = function(b)
{
    this.width = 30;
    this.height = 20;
    var nodes = [];
    var map = [];
    // articulation table from https://github.com/a1k0n/tronbot/blob/a1k0nbot-2.18.2/cpp/artictbl.h#L1
    var articulation =
       [0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,
        0,1,1,1,1,1,1,1,0,1,0,0,0,1,0,0,
        0,1,1,1,1,1,1,1,0,1,0,0,0,1,0,0,
        0,1,1,1,1,1,1,1,0,1,0,0,0,1,0,0,
        0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        0,1,1,1,1,1,1,1,0,1,0,0,0,1,0,0,
        0,1,1,1,1,1,1,1,0,1,0,0,0,1,0,0,
        0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0,
        1,1,1,1,1,1,1,1,1,1,0,0,1,1,0,0,
        0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0,
        1,1,1,1,1,1,1,1,1,1,0,0,1,1,0,0,
        0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0];


    for( var i = 0, p = this.width * this.height; i < p; i++ ) {
        var node = new Node(this, i);
        nodes[i] = node;
        if( i > 29 ) node.add(0, nodes[i - 30]);
        if( i % 30 > 0 ) node.add(3, nodes[i - 1]);
        map[i] = 0;
    };

    this.nodes = function(){ return nodes; };
    this.node = function(x, y){return undefined === y ? nodes[x] : (x >= 0 && x <= 29 && y >= 0 && y <= 19 ? nodes[x + y * 30] : null); };
    this.idx = function(x, y){ return x >= 0 && x <= 29 && y >= 0 && y <= 19 ? x + y * 30 : undefined; }
    this.isLocked = function(i){ return undefined === map[i] ? 1 : (map[i] ? 1 : 0); };
    this.isNeighbor = function(node, position){
        var i = node.id, w = this.width, k = i % 30, p = position.id + 1;
        return (k > 0 && map[i - 1] === p) || (k < 29 && map[i + 1] === p) || map[i-w] === p || map[i+w] === p;
    };
    this.isPossibleCutVertex = function(node){
        var i = node.id, w = this.width, k = i % 30;
        var mask = (k > 0 ? this.isLocked(i-w-1) : 1) | this.isLocked(i-w) << 1 | (k < 29 ? this.isLocked(i-w+1) : 1) << 2
            | (k < 29 ? this.isLocked(i+1) : 1) << 3 | (k < 29 ? this.isLocked(i+w+1) : 1) << 4 | this.isLocked(i+w) << 5
            | (k > 0 ? this.isLocked(i+w-1) : 1) << 6 | (k > 0 ? this.isLocked(i-1) : 1) << 7;
        return articulation[mask];
    };
    this.lock = function(node, position){ map[node.id] = position.id + 1; }
    this.unlock = function(node){ map[node.id] = 0; }
    this.edges = function(node){
        var i = node.id, w = this.width, k = i % 30;
        return (k > 0 ? !map[i-1] : 0) + (k < 29 ? !map[i+1] : 0) + !map[i-w] + !map[i+w];
    };
};

Strategy = function(b)
{
    var isTimedOut = function()
    {
        return timer.current('turn') > 80;
    };

    var deepfill = function(node, level, parent)
    {
        var ret = 0;
        if( isTimedOut() ) return ret;
        var best = MINVAL, val, next, bestDirection;
        var e = new Evaluation(true, false);

        node.each(function(direction)
        {
            var component = e.component(this);
            val = component.edges - component.available - 4 * b.map.isPossibleCutVertex(this) - 2 * b.map.edges(this);
            if( val > best ) { best = val; next = this; bestDirection = direction; }
        });

        if( ! next ) return ret;

        b.me.move(next);
        var result = deepfill(node, level - 1);
        b.me.unmove();
        return node === parent ? [result, bestDirection] : result;
    };

    this.fill = function()
    {
        timer.start('fill');
        var result = deepfill(b.me.node(), 10, b.me.node());
        b.me.direction = undefined !== result[1] ? result[1] : null;
        timer.stop('fill');
    };

    this.attack = function()
    {
        timer.start('voronoi diff attack')
        var target = b.currentEvaluation.closest();
        if( ! target ) return null;

        var node = b.me.node(), best = MINVAL, worst, distance = b.currentEvaluation.distance(target),
            changeStrategyDistance = 2;

        node.each(function(d)
        {
            b.me.move(this);

            worst = MAXVAL;
            var lose = false;
            if( distance > changeStrategyDistance )
            {
                var e = new Evaluation(false, true);
                worst = e.voronoi(b.me).available - e.voronoi(target).available - 100 * e.distance(target)
                    - 20 * b.map.edges(this);
            }
            else
            {
                target.node().each(function()
                {
                    target.move(this);
                    var e = new Evaluation(false, true);
                    var available = e.voronoi(b.me).available - e.voronoi(target).available - 4 * e.distance(target);
                    if( e.voronoi(b.me).available / e.voronoi(target).available < 0.2 ) lose = true;
                    target.unmove();

                    if( available < worst && ! lose ) worst = available;
                });
            }

            b.me.unmove();
            if( best < worst && ! lose ) { best = worst; b.me.direction = d; }
        });

        timer.stop('voronoi diff attack')
    };

    // todo change choose strategy
    this.choose = function()
    {
        timer.start('changing direction');
        var best = MINVAL, direction = null, node = b.me.node(), val, target = b.currentEvaluation.closest();

        node.each(function(d)
        {
            b.me.move(this);

            var worst = MAXVAL;

            if(target)
            {
                target.node().each(function()
                {
                    target.move(this);
                    var e = new Evaluation(false, true);
                    val = e.voronoi(b.me).available;
                    target.unmove();
                });

                if( val < worst ) worst = val;
            }
            else
            {
                var e = new Evaluation(false, true);
                val = e.voronoi(b.me).available;
                if( val < worst ) worst = val;
            }

            b.me.unmove();
            if( best < worst ) { best = worst; b.me.direction = d; }
        });

        timer.stop('changing direction');
    };
};

Board = function()
{
    this.map = new Map(this);
    this.strategy = new Strategy(this);

    this.positions = {};
    this.activePlayers = 0;
    this.me = null;
    this.directions = ['UP', 'RIGHT', 'DOWN', 'LEFT', 'You Touch My Tralala)'];
    this.mode = null;

    this.currentEvaluation = null;

    var iteration = 0;

    this.selectStrategy = function()
    {
        var e = this.currentEvaluation = new Evaluation();

        if( 0 === e.component(b.me.node()).available ) // cut vertex
        {
            timer.start('strategy: choose');
            this.strategy.choose();
            timer.stop('strategy: choose');
        }
        else if( e.neighbors().length )
        {
            timer.start('strategy: attack');
            this.strategy.attack();
            timer.stop('strategy: attack');
        }

        if( null === this.me.direction ) {
            this.strategy.fill();
        }

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
                if( data[i][2] < 0 )
                {
                    this.positions[i].clear();
                    this.positions[i] === this.strategy.getPossibleNeighbor() && this.strategy.clearNeighbor();
                    delete this.positions[i];
                    this.activePlayers--;
                }
                else this.positions[i].set(data[i][2], data[i][3]);
            }
        }

        this.me.direction = null;
        this.selectStrategy();
        timer.stop('turn');
        print(this.directions[this.me.direction]);
    };

    this.getIteration = function(){ return iteration; };
};


