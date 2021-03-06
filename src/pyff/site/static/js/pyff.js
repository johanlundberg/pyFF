/**
 * Created with PyCharm.
 * User: leifj
 * Date: 2/6/13
 * Time: 2:14 PM
 * To change this template use File | Settings | File Templates.
 */

(function( $ ) {
    // send the user directly to the pre-selected idp if that setting exists

    function _autoselect() {
        var use_idp;
        use_idp = $.jStorage.get('pyff.discovery.idp');
        if (use_idp) {
            ds_select(use_idp);
        }
    }

    _autoselect();

    function ds_select(entityID) {
        var params;
        params = $.deparam.querystring();
        var qs;
        //console.log(entityID);
        qs = params['return'].indexOf('?') === -1 ? '?' : '&';
        if ($('#remember').is(':checked')) {
            $.jStorage.set('pyff.discovery.idp',entityID);
        }
        var returnIDParam = params['returnIDParam'];
        if (! returnIDParam) {
            returnIDParam = "entityID";
        }
        window.location = params['return']+qs+returnIDParam+'='+entityID;
        return false;
    }

    function contains_idp(idp,lst) {
        for (var i = 0; i < lst.length; i++) {
            var item = lst[i];
            if (item['entityID'] == idp['entityID']) {
                return true;
            }
        }
        return false;
    }

    function addIdP(item) {
        var idps = $.jStorage.get('pyff.discovery.idps',[]);
        //console.log(item);
        if (!contains_idp(item,idps)) {
            idps.unshift(item);
        }
        while (idps.length > 3) {
            idps.pop()
        }
        $.jStorage.set('pyff.discovery.idps',idps);
        return ds_select(item['entityID']);
    }

    function find_idp(id,lst) {
        for (var i = 0; i < lst.length; i++) {
            if (id == lst[i]['entityID']) {
                return i
            }
        }
        return -1
    }

    function select_idp(id) {
        $.ajax({
            datatype: 'json',
            url: '/metadata/' + id + ".json",
            success: function (data) {
                for (var i = 0; i < data.length; i++) {
                    //console.log("fetched: "+data[i]);
                    return addIdP(data[i]);
                }
            }
        });
    }

    function cmp_title(a,b) {
        if (a.title == b.title){
            return 0;
        }
        return a.title > b.title ? 1 : -1;
    }

    var methods;
    methods = {
        init: function (options) {
            this.filter('input').each(function (opts) {
                var seldiv = $(this);
                var uri = seldiv.attr('data-target');
                seldiv.typeahead({
                    remote: uri+"?query=%QUERY&entity_filter={http://pyff-project.org/role}idp",
                    engine: Hogan,
                    limit: 10,
                    template: '{{label}}'
                });
                seldiv.bind('typeahead:selected',function(event,entity) {
                    if (entity) {
                       select_idp(entity.id);
                    }
                });
                $.each(options,function(key,val) {
                    seldiv.dsSelect(key,val);
                });
            });
            this.filter('select').each(function (opts) {
                var seldiv = $(this);
                seldiv.change(function(opt) {
                    //console.log(opt);
                    select_idp(seldiv.find('option:selected').attr('value')); // TODO - fix id in xsltjson xslt
                });
                $.each(options,function(key,val) {
                    seldiv.dsSelect(key,val);
                });
            });
            $("button.unselect").bind('click.ds', methods.unselect);
            $("a.select").bind('click.ds',methods.select);
        },
        refresh: function() {
            this.filter('select').each(function() {
                var seldiv = $(this);
                seldiv.html($('<option>').attr('value','').append($('<em>').append(seldiv.attr('title'))))
                $.getJSON('/role/idp.json',function (data) {
                    $.each($(data).sort(cmp_title),function(pos,elt) {
                        seldiv.append($('<option>').attr('value','{sha1}'+CryptoJS.SHA1(elt.entityID)).append(elt.title));
                    })
                });
            });
        },
        unselect: function (e) {
            e.preventDefault();
            //e.stopPropagation();
            var id = $(this).attr('rel');
            var idps = $.jStorage.get('pyff.discovery.idps', []);
            var idx = find_idp(id, idps);
            if (idx != -1) {
                idps.splice(idx, 1);
                $.jStorage.set('pyff.discovery.idps', idps);
                $(this).parent().remove();
            }
        },
        select: function(e) {
            e.preventDefault();
            return ds_select($(this).attr('href'));
        }
    };

    $("img.fallback-icon").error(function(e) {
        $(this).error(function(e) {});
        $(this).attr('src','1x1t.png').removeClass("img-thumbnail").hide();
    });

    var idp_template = Hogan.compile('<a class="select list-group-item" href="{{entityID}}">' +
        '{{^sticky}}<button type="button" class="close unselect" rel="{{entityID}}">&times;</button>{{/sticky}}' +
        '<h4 class="list-group-item-heading">{{title}}</h4>' +
        '<p class="list-group-item-text">' +
        '{{#icon}}<img src="{{icon}}" class="fallback-icon hidden-xs idp-icon pull-right img-responsive img-thumbnail"/>{{/icon}}' +
        '{{#descr}}<div class="pull-left idp-description hidden-xs">{{descr}}</div>{{/descr}}' +
        '<div class="clearfix"></div>' +
        '</p></a>');

    $.fn.dsQuickLinks = function(id) {
        this.each(function() {
            var outer = $(this);
            var uri = outer.attr('data-target');
            var div = $('<div>').addClass("list-group");
            outer.html(div);

            var from_storage = 0;
            div.append(function() {
                var lst = $.jStorage.get('pyff.discovery.idps',[]);
                for (var i = 0; i < lst.length; i++) {
                    div.append(idp_template.render(lst[i]));
                    from_storage++;
                }
            });

            if (from_storage == 0) {
                $.getJSON(uri+"?entity_filter={http://pyff-project.org/role}idp", function (data) {
                    $.each(data,function(pos,elt) {
                        if (pos < 3) {
                            $.getJSON("/metadata/"+elt.id+".json", function (entites) {
                                $.each(entites,function(ipos,entity) {
                                    console.log(entity);
                                    entity.sticky = true
                                    div.append(idp_template.render(entity));
                                })
                            });
                        }
                    });
                });
            }
        });
    };

    $.fn.dsSelect = function(method) {
        if ( methods[method] ) {
            return methods[method].apply( this, Array.prototype.slice.call( arguments, 1 ));
        } else if ( typeof method === 'object' || ! method ) {
            return methods.init.apply( this, arguments );
        } else {
            $.error( 'Method ' +  method + ' does not exist on jQuery.dsSelect' );
        }
    };

    $.fn.dsRelyingParty = function(id) {
        var o = $(this);
        $.ajax({
            url: '/metadata/'+ id +'.json',
            dataType: 'json',
            success: function(data) {
                for (var i = 0; i < data.length; i++) {
                    var entity = data[i];
                    $(o).filter("img.sp-icon").each(function() {
                        if (entity.icon) {
                            $(this).attr('src',entity.icon).addClass("img-responsive img-thumbnail")
                        } else {
                            $(this).hide();
                        }
                    });
                    $(o).filter(".sp-name").each(function() {
                        if (entity.title) {
                            $(this).append(entity.title)
                        }
                    });
                    $(o).filter(".sp-description").each(function() {
                        if (entity.descr) {
                            $(this).append(entity.descr);
                        }
                    });
                    $(o).filter("a.sp-privacy-statement-url").each(function() {
                        if (entity.psu) {
                            $(this).attr('href',entity.psu).append($('<em>').append($(this).attr('title')));
                        }
                    });
                }
            }
        });
    };
})( jQuery );