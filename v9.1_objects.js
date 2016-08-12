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
    this.lock = function(){ this.locked = 0; map.locked++; };
    this.unlock = function(){ this.locked = 1; map.locked--; };
    this.isLocked = function(){ return ! this.locked };
    this.toString = function(){return this.id};
    this.each = function(cb){ var next; for( var i = 0; i < 4; i++ ){ next = this.next(i); if( ! next ) continue; cb.call(next, i); } };
    this.each2 = function(cb){ var next; for( var i = 0; i < 4; i++ ){ next = this.neighbors[i]; if( ! next ) continue; cb.call(next, i); } };
    this.isNeighbor = function(node){ for( var i in this.neighbors ) if( node === this.neighbors[i] ) return true; };
    this.isNear = function(position){ if( position && this.neighborMask & 1 << position.id ) return 1; return 0; };
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
//        printErr('articulation points ', points);
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
    this.move = function(newNode){node && last.push(node); node = newNode; node.lock(); node.owner = this; node.each(function(){this.edges--;}); };
    this.unmove = function(){ node.unlock(); node.owner = null; node.each(function(){this.edges++;}); node = last.pop(); };
    this.node = function(){ return node; };
    this.clear = function(){ while(this.node()){ this.unmove() } };
    this.history = function(){ var ret = last.slice(0); ret.push(node); return ret; };
    this.next = function(d){ return node.next(d) };
    this.toString = function(){ return this.id; };
    this.moveToDirection = function(d){ var next = node.next(d); next && this.move(next); };
};

Voronoi = function(b)
{
    var owned, available, distances, q = [], enemies, battlefront;

    this.calculate = function(exactPositions)
    {
        owned = [], available = {}, distances = [], enemies = {}, battlefront = 0;
        var node, currentDistance;
        node = b.me.node(); // start from my node

        q.push(node); available[b.me] = 0; distances[node] = 0;
        var positions = exactPositions || b.positions;

        for( var k in positions )
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
            node.owner = owner;
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

                battlefront++;
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
            if( b.me === positions[k] ) continue;
            if( null !== positions[k].distance && distance > positions[k].distance ) {
                b.me.target = positions[k]; distance = positions[k].distance;
            }
        }
    };

    this.owned = function(){ return owned; };
    this.available = function(player){ return available[player]; };
    this.enemies = function(){ var count = 0; for(var i in enemies) count++; return count; };
    this.battlefront = function() { return battlefront; };
};

Components = function(b)
{
    var visited, spaces, num, low, vertex, current, edges, neighbors;

    var calculateNeighborsDeep = function(component, node, parent)
    {
        if( visited[node] ) return;

        node.vertex = 0;
        var curnode = ++current;
        var children = 0, nodeEdges = 0, next;
        num[component][node] = low[component][node] = curnode;
        visited[node] = component;
        spaces[component]++;
        node.neighborMask = 0;

        for( var i = 0; i < 4; i++ )
        {
            next = node.neighbors[i];
            if( ! next ) continue;

            if( next.isLocked() )
            {
                if( next.owner  ) {
                    b.me !== next.owner && (neighbors[next.owner.id] = next.owner);
                    node.neighborMask |= 1 << next.owner.id;
                }
                continue;
            }

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

    this.calculate = function(node)
    {
        visited = [], spaces = [], num = [], low = [], vertex = [], current = 0, edges = [], neighbors = [];
        var component = 0, next;
        node = node || b.me.node();
        node.unlock();

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

        node.lock();
    };

    this.spaces = function(node){ return node ? (spaces[this.component(node)] || 0) : spaces; };
    this.setSpaces = function(node, val){ spaces[this.component(node)] + val; };
    this.edges = function(node){ return node ? (edges[this.component(node)] || 0) : edges; };
    this.component = function(node){ return visited[node] || 0; };
    this.neighbors = function(){ return neighbors; };
};

Strategy = function(b)
{
    var spacesForDeepIteration, possibleLoseNeighbor;
    var isTimedOut = function()
    {
        return timer.current('turn') > 80;
    };

    var isTimedOut2 = function()
    {
        return timer.current('turn') > 90;
    };

    var floodfill = function(node)
    {
        var next, best = 0, val;
        node.each(function()
        {
            if( possibleLoseNeighbor )
                val = 30 - 2 * this.edges - 6 * this.vertex - this.isNear(possibleLoseNeighbor) + 2 * this.isNear(b.me);
            else
                val = 30 - 2 * ( this.edges > 1 ? this.edges : 10 ) - 6 * this.vertex;// + 2 * this.isNear(b.me);

            if( best < val ) { best = val; next = this };
        });

        if( 0 === best ) return node.isNear(possibleLoseNeighbor);
        b.me.move(next);
        var ret = 1 + floodfill(next);
        b.me.unmove();
        return ret;
    };


    var deepIteration = function(node, level)
    {
        if( isTimedOut2() ) return 0;
        if( 0 === level ) return floodfill(node);
        var best = 0, next, val, sublvl = level - 1;

        for( var i = 0; i < 4; i++ )
        {
            if( isTimedOut2() ) break;
            next = node.next(i);
            if( ! next ) continue;

            b.me.move(next);
            spacesForDeepIteration--;
            val = 1 + deepIteration(next, sublvl);
            spacesForDeepIteration++;
            b.me.unmove();
            if( best < val ) { best = val; node.bestDirection = i; };
            if( val >= spacesForDeepIteration ) break;
        }

        return best;
    };

    this.fill = function()
    {
        timer.start('fill');

        b.components.calculate();
        var best = 0, direction = null, mySpaces;
        mySpaces = spacesForDeepIteration = b.components.spaces(b.me.node());

        for( var i = 1; i <= mySpaces; i++ )
        {
            if( isTimedOut() ) break;
            var val = deepIteration(b.me.node(), i);
            if( best < val ) { best = val; direction = b.me.node().bestDirection; };
            if( val <= i ) break;
        }

        timer.stop('fill');
        return direction;
    };

    this.getPossibleNeighbor = function(){
        return possibleLoseNeighbor;
    };

    this.clearNeighbor = function(){
        possibleLoseNeighbor = null;
    };

    var heuristic = function(target)
    {
        b.voronoi.calculate([b.me, target]);
//        console.log('my', b.voronoi.available(b.me), 'enemy', b.voronoi.available(target), 'position', b.me.node().id);
//        if( null !== target.distance ) {
        if( target.distance )
            return b.voronoi.available(b.me);
        else
            return b.voronoi.available(b.me) - b.voronoi.available(target);
            // - b.voronoi.available(target);
//        }
//        else {
//            b.components.calculate();
//            return b.components.spaces(b.me.node());
//        }

    };

    var alphabeta = function(target, alpha, beta, max, level)
    {
        var player = max ? b.me : target;
        if( isTimedOut() ) return alpha;
        if( 0 === level ) return heuristic(target);

        var node = player.node();
        if( ! node.edges ) return MINVAL;

        for( var i = 0; i < 4; i++ )
        {
            if( isTimedOut() ) break;
            var next = node.next(i);
            if( ! next ) continue;

            player.move(next);
            var val = - alphabeta(target, -beta, -alpha, ! max, level - 1);
            if( val > alpha ) { alpha = val; node.bestDirection = i; }
            player.unmove();


            if( isTimedOut() ) return MINVAL;
            if( alpha >= beta ) break;
        }

        return alpha;
    };

    this.attack = function()
    {
        b.voronoi.calculate();
        if( ! b.me.target ) return null;

        var target = b.me.target, best = MINVAL, direction = null;

        for( var i = 1; i < 20; i++ )
        {
            if( isTimedOut() ) break;
            var val = alphabeta(target, MINVAL, MAXVAL, true, i * 2);

            if( MAXVAL === val ) return b.me.node().bestDirection;
            if( MINVAL === val ) return direction;
            if( val > best ) { best = val; direction = b.me.node().bestDirection; }
        }

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
        timer.start('attack strategy');
        this.me.direction = this.strategy.attack();
        timer.stop('attack strategy');

        if( null === this.me.direction ) {
            this.me.direction = this.strategy.fill();
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

        this.activePlayers === 2 && this.strategy.clearNeighbor();

        this.me.target = null;
        this.me.direction = null;
        this.mode = null;
        this.selectStrategy();
        print(this.directions[this.me.direction]);
        timer.stop('turn');
    };

    this.getIteration = function(){ return iteration; };
};


