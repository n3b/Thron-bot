this.attack = function(positions, myIndex, enemyIndex)
{
    var direction = 0;
    var best = - map.width * map.height;

    for( var i = 0; i < 4; i++ )
    {
        var next = map.next(positions[myIndex].index(), i);
        if( null === next ) continue;

        positions[myIndex].move(next);

        var worst = map.width * map.height;
        for( var n = 0; n < 4; n++ )
        {
            var next2 = map.next(positions[enemyIndex].index(), n);
            if( null === next2 ) continue;

            positions[enemyIndex].move(next2);
            voronoi.calculate(positions, myIndex);
            var val2 = voronoi.available(myIndex) - voronoi.available(enemyIndex);
            positions[enemyIndex].unmove();

            if( val2 < worst )
                worst = val2;
        }

        positions[myIndex].unmove();

        if( worst > best ) {
            best = worst;
            direction = i;
        }
    }

    return direction;
};