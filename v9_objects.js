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
            printErr('player ', positions[k].id, ' distance ', positions[k].distance)
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

    var floodfill = function(node)
    {
        var next, best = 0, val;
        node.each(function()
        {
            if( possibleLoseNeighbor )
                val = 30 - 2 * this.edges - 6 * this.vertex - this.isNear(possibleLoseNeighbor) + 2 * this.isNear(b.me);
            else
                val = 30 - 2 * ( this.edges > 1 ? this.edges : 10 ) - 6 * this.vertex - 2 * this.isNear(b.me);

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
        if( isTimedOut() ) return 0;
        if( 0 >= level ) return floodfill(node);
        var best = 0, next, val, sublvl = level - 1;

        for( var i = 0; i < 4; i++ )
        {
            if( isTimedOut() ) break;
            next = node.next(i);
            if( ! next ) continue;

            b.me.move(next);
//            if( b.map.isPossibleCutVertex(next) ) b.components.calculate();
            spacesForDeepIteration--;
            val = next.isNear(possibleLoseNeighbor) ? 1 : 1 + deepIteration(next, sublvl);
            spacesForDeepIteration++;
            b.me.unmove();
//            if( next.vertex ) b.components.calculate();
            if( best < val ) { best = val; node.bestDirection = i; };
            if( val >= spacesForDeepIteration ) break;
        }

        return best;
    };

    this.fill = function()
    {
        timer.start('fill');

        var best = 0, direction = null;
        var enemySpaces = 1000;

        if( ! possibleLoseNeighbor )
        {
            var neighbors = b.components.neighbors();
            if( b.activePlayers > 2 && neighbors )
            {

                printErr(neighbors.length);
                for( var i in neighbors )
                {
                    b.components.calculate(neighbors[i].node());
                    var currentSpaces = b.components.spaces(neighbors[i].node());
                    if( enemySpaces > currentSpaces ) { enemySpaces = currentSpaces; possibleLoseNeighbor = neighbors[i]; }
                }
            } else {
                return this.simplefill();
            }

        }

        b.components.calculate(b.me.node());
        var mySpaces = b.components.spaces(b.me.node());
        spacesForDeepIteration = mySpaces;

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

    var deepfill = function(node, level)
    {
        var ret = 0;
        if( isTimedOut() || 0 === level ) return ret;
        var best = -1000, val, next, bestDirection;
        b.components.calculate();

        node.each(function(direction)
        {
            val = b.components.edges(this) - b.components.spaces(this) - 4 * this.vertex - 2 * this.edges;// - 2 * this.countEnemies();
            if( val > best ) { best = val; next = this; bestDirection = direction; }
        });

        if( ! next ) return ret;

        b.me.move(next);
        var result = 1 + deepfill(next, level - 1);
        b.me.unmove();
        return result;
    };

    this.simplefill = function()
    {
        timer.start('fill');
        var best = -1000, direction = null;
        b.me.node().each(function(d){
            b.me.move(this);
            var val = deepfill(this, 2);

//            var val = b.components.edges(this) - b.components.spaces(this) - 4 * this.vertex - 2 * this.edges;
            if( val > best ) { best = val; direction = d; }
            b.me.unmove();
        });
        timer.stop('fill');
        return direction;
    };

    this.getPossibleNeighbor = function(){
        return possibleLoseNeighbor;
    };

    this.clearNeighbor = function(){
        possibleLoseNeighbor = null;
    };

    this.attack = function()
    {
        timer.start('voronoi diff attack')
        if( ! b.me.target ) return null;
        var target = b.me.target;

        var direction = null, node = b.me.node(), best = -1000000, worst;
        var distance = target.distance;
        var changeStrategyDistance = 2;
        printErr('distance ', distance);

        node.each(function(d)
        {
            b.me.move(this);
            worst = 1000000;
            var myNode = this;

            if( distance > changeStrategyDistance )
            {
                b.voronoi.calculate();
                worst = b.voronoi.available(b.me) - b.voronoi.available(target) - 20 * target.distance - 20 * this.edges;
            }
            else
            {
                target.node().each(function()
                {
                    target.move(this);
                    b.voronoi.calculate();
                    var myspace = b.voronoi.available(b.me), enemyspace = b.voronoi.available(target);
                    var available = myspace - enemyspace - 4 * target.distance;
                    if( myspace / (enemyspace + 1) < 0.2 ) available = -1000000;

                    if( available < worst ) worst = available;
                    if( enemyspace === 1 ) worst = 1000000;
                    target.unmove();
                });
            }

            b.me.unmove();

            if( best < worst ) { best = worst; direction = d; }
        });

        timer.stop('voronoi diff attack')
        return direction;
    };

    this.changeDirection = function()
    {
        timer.start('changing direction');

        var best = -1000000, direction = null, node = b.me.node(), val;
        var target = b.me.target;

        if( ! target )
        {
            b.components.calculate();
            node.each(function(d)
            {
                var val = b.components.edges(this);
                if( best < val ) { best = val; direction = d; }
            });
        }
        else
        {
            target.node().unlock();
            b.components.calculate();
            target.node().lock();
            node.each(function(d)
            {
                if( b.components.component(this) === b.components.component(target.node()) )
                {
                    b.me.move(this);
                    val = 1000000;
                    var myNode = this;

                    target.node().each(function()
                    {
                        target.move(this);
                        b.voronoi.calculate();
//                        var worst = b.voronoi.available(b.me) > b.voronoi.available(target) ? b.components.spaces(myNode) : b.voronoi.available(b.me);
                        var worst = b.voronoi.available(b.me);
                        target.unmove();
                        if( val > worst ) val = worst;
                    });
                    printErr('same component, val', val);
                    b.me.unmove();
                }
                else {
                    val = b.components.spaces(this);
                    printErr('other component, val', val);
                }

                if( best < val ) { best = val; direction = d; }
            });
        }

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
        ! this.strategy.getPossibleNeighbor() && this.components.calculate();
        timer.stop('first calculation');

        if( ! this.strategy.getPossibleNeighbor() && this.map.isPossibleCutVertex(this.me.node()) ) {
            timer.start('change direction strategy');
            this.me.direction = this.strategy.changeDirection();
            timer.stop('change direction strategy');
        }

        if( this.me.target )
        {
            timer.start('attack strategy');
            this.me.direction = this.strategy.attack();
            timer.stop('attack strategy');
        }

        if( null === this.me.direction ) this.me.direction = this.strategy.simplefill();

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


