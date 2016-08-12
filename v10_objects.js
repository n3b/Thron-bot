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
    this.neighborMask = 0;

    this.next = function(d) { return this.neighbors[d] && !this.neighbors[d].isLocked() ? this.neighbors[d] : null; }; //todo
    this.add = function(d, node) { if( this.neighbors[d] ) return; this.neighbors[d] = node; node.add(d > 1 ? d - 2 : d + 2, this); this.edges++ };
    this.lock = function(){ this.locked = 0; };
    this.unlock = function(){ this.locked = 1; };
    this.isLocked = function(){ return ! this.locked };
    this.toString = function(){return this.id};
    this.each = function(cb){ var next; for( var i = 0; i < 4; i++ ){ next = this.next(i); if( ! next ) continue; cb.call(next, i); } };
    this.each2 = function(cb){ var next; for( var i = 0; i < 4; i++ ){ next = this.neighbors[i]; if( ! next ) continue; cb.call(next, i); } };
    this.isNeighbor = function(node){ for( var i in this.neighbors ) if( node === this.neighbors[i] ) return true; };
    this.isNear = function(position){ if( position && this.neighborMask & 1 << position.id ) return 1; return 0; };
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

    for( var i = 0, p = this.width * this.height; i < p; i++ ) {
        var node = new Node(this, i);
        nodes[i] = node;
        if( i > 29 ) node.add(0, nodes[i - 30]);
        if( i % 30 > 0 ) node.add(3, nodes[i - 1]);
        map[i] = 0;
    };

    this.lock = function(node, position){ map[node.id] = position.id + 1; }
    this.unlock = function(node){ map[node.id] = 0; }
    this.edges = function(node){
        var i = node.id, w = this.width, k = i % 30;
        return (k > 0 ? !map[i-1] || 0 : 0)+(k < 29 ? !map[i+1]||0:0)+(!map[i-this.width]||0)+(!map[i+this.width]||0);
    };
};

Strategy = function(b)
{
    var isTimedOut = function()
    {
        return timer.current('turn') > 80;
    };

    var isTimedOut2 = function()
    {
        return timer.current('turn') > 80;
    };

    var countMaxTraversableSpaces = function(node)
    {
        var spaces = 0, component = b.currentEvaluation.component(node);
        var visited = [];
        visited[component.id] = component;
        node.each(function(){
            var c = b.currentEvaluation.component(this);
            if( c !== component ) {
                spaces = Math.max(spaces, c.maxTraversableSpace(visited));
            }
        });
        return spaces;
    };

    var floodfill = function(node, component)
    {
        var next, best = 0, val;
        node.each(function()
        {
            val = component.maxTraversableSpace() - 2 * b.map.edges(this) - 4 * b.map.isPossibleCutVertex(this);
            if( best < val ) { best = val; next = this };
        });

        if( 0 === best ) return 0;

        b.me.move(next);
        var ret = 1 + floodfill(next, component);
        b.me.unmove();
        return ret;
    };

    var fillIteration = function(node, level, component)
    {
        if( isTimedOut2() ) return 0;
        if( 0 === level ) return floodfill(node, component);
        var best = 0, next, val, sublvl = level - 1;

        for( var i = 0; i < 4; i++ )
        {
            if( isTimedOut2() ) break;
            next = node.next(i);
            if( ! next ) continue;

            b.me.move(next);
            val = 1 + fillIteration(next, sublvl, component);

            b.me.unmove();
            if( best < val ) { best = val; node.bestDirection = i; };
            if( val >= component.maxTraversableSpace() ) break;
        }

        return best;
    };

    this.fill = function()
    {
        timer.start('fill');

        var e = b.currentEvaluation, best = 0, mySpaces, component = e.component(b.me.node());
        mySpaces = e.component(b.me.node()).maxTraversableSpace();

        for( var i = 1; i <= mySpaces; i++ )
        {
            if( isTimedOut() ) break;
            var val = fillIteration(b.me.node(), i, component);
            if( best < val ) { best = val; b.me.direction = b.me.node().bestDirection; };
            if( val <= i ) break;
        }

        timer.stop('fill');
    };

    var closeCombatHeuristic = function(target)
    {
        var evaluation = new Evaluation(false, true), v1 = evaluation.voronoi(b.me), v2 = evaluation.voronoi(target);

        var ret = null === evaluation.distance(target)
            ? v1.available - v2.available - 100000
            : v1.available - v2.available - 4 * evaluation.distance(target);

        return ret;
    };

    var standartHeuristic = function(target)
    {
        var evaluation = new Evaluation(false, true), v1 = evaluation.voronoi(b.me), v2 = evaluation.voronoi(target);

        var ret = null === evaluation.distance(target)
            ? v1.available - v2.available - 100000
            : v1.available - v2.available - 10 * evaluation.distance(target);

//        printErr('heuristic ', ret, ' edges ', b.map.edges(b.me.node()));

        return ret;
    };

    var alphabeta = function(heuristic, target, alpha, beta, max, level)
    {
        var player = max ? b.me : target;
        if( isTimedOut() ) return alpha;
        if( 0 === level ) return heuristic(target);

        var node = player.node();
        if( ! b.map.edges(node) ) return MINVAL;

        for( var i = 0; i < 4; i++ )
        {
            if( isTimedOut() ) break;
            var next = node.next(i);
            if( ! next ) continue;

            player.move(next);
            var val = - alphabeta(heuristic, target, -beta, -alpha, ! max, level - 1);
            if( val > alpha ) { alpha = val; node.bestDirection = i; }
            player.unmove();


            if( isTimedOut() ) return alpha;
            if( alpha >= beta ) break;
        }

        return alpha;
    };

    this.attack = function()
    {
        var e = b.currentEvaluation, target, distance;
        target = e.closest();
        if( ! target ) return;

        distance = e.distance(target);
        var heuristic = distance <= 2 ? closeCombatHeuristic : standartHeuristic;
        var best = MINVAL;

        for( var i = 1; i < 3; i++ )
        {
            if( isTimedOut() ) break;
            var val = alphabeta(heuristic, target, MINVAL, MAXVAL, true, i * 2);
            printErr('val - ', val);
            if( MAXVAL === val ) return b.me.direction = b.me.node().bestDirection;
            if( MINVAL === val ) continue;
            if( val > best ) { best = val; b.me.direction = b.me.node().bestDirection; }
        }
    };

    this.choose = function()
    {
        var e = b.currentEvaluation, vNodes = e.voronoi(b.me).nodes, q = [], node, best = 0;

        b.me.node().each(function(d)
        {
            if( ! vNodes[this] ) return;

            var count = 1, visited = [];
            q.push(this);
            visited[this] = this;

            while( node = q.shift() )
            {
                node.each(function()
                {
                    if( vNodes[this] && ! visited[this] )
                        { q.push(this); count++; visited[this] = this; }
                });
            }

            count -= 2 * b.map.edges(this) + 4 * b.map.isPossibleCutVertex(this);

            if( best < count )
            {
                best = count;
                b.me.direction = d;
            }
        });
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


