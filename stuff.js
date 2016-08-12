this.test = function()
{
    timer.start('test attack');
    var direction = null;
    var best = -1000000, worst = 1000000, val, next, node;

    node = b.me.node();
    for( var i = 0; i < 4; i++ )
    {
        next = node.next(i);
        if( ! next ) continue;

        var val = minmax(function(max){
            max ? b.me.node().unlock : b.me.target.position.node.unlock();
            b.components.calculate()
            max ? b.me.node().lock : b.me.target.position.node.lock();

            b.voronoi.calculate();
            return b.voronoi.available(b.me) - b.voronoi.available(b.me.target.position) - 10 * b.me.target.distance - 10 * 4 * this.vertex;
        }, b.me, b.me.target.position, true, best, worst);

        if( best < val ) { best = val; direction = i; }
    }
    printErr('best ' + best);

    timer.stop('test attack');
    return direction;
};

function minmax(heuristic, me, target, max, a, b)
{
    if( timer.current('turn') > 90 ) return 0;
    if( timer.current('turn') > 50 ) return heuristic(max);
    var player, node, next, moves = 0;
    player = max ? me : target;
    node = player.node();

    for( var i = 0; i < 4; i++ )
    {
        next = node.next(i);
        if( ! next ) continue;

        if( max ) {
            player.move(this);
            a = Math.max(a, minmax(heuristic, me, target, false, a, b) );
            player.unmove();
            if( b <= a ) return a;
        } else {
            player.move(this);
            b = Math.min(b, minmax(heuristic, me, target, true, a, b) );
            player.unmove();
            if( a <= b ) return b;
        }
    }

    return max ? - 1000000 : 1000000;
};

