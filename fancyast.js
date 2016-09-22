(function ( Fancy ) {
    /**
     *
     * @param expression
     * @returns {ASTCompiler}
     * @constructor
     */
    function ASTCompiler( expression ) {
        var SCOPE_NAME = "s",
            EXTRA_NAME = "l",
            varCount   = 0;

        var opened = 0;

        this.type = {
            "function"         : "FUNCTION",
            "bracketExpression": "BRACKETEXPRESSION",
            "identifier"       : "IDENTIFIER",
            "filter"           : "FILTER",
            "expression"       : "EXPRESSION",
            "functionCall"     : "FUNCTIONCALL"
        };

        this.functionCount = [];
        this.variablePath  = [];
        this.lastVariable  = "";
        this.variables     = [];
        this.declarations  = [];
        this.body          = [];


        this.if              = function ( scope, value, varName, call ) {
            return (this.isIn( "SCOPE", "PROPERTY" ) + " {VAR = SCOPE.PROPERTY" + (call ? "()" : "") + "} " + this.elseIn( "EXTRA", "PROPERTY" ) + " {VAR = EXTRA.PROPERTY" + (call ? "()" : "") + "}").replace( /SCOPE/gi, scope ).replace( /PROPERTY/gi, value ).replace( /VAR/gi, varName ).replace( /EXTRA/gi, EXTRA_NAME );
        };
        this.notNull         = function ( varName ) {
            return "if( " + varName + " !== undefined && " + varName + " !== null )";
        };
        this.isIn            = function ( currentVarName, call ) {
            return "if( " + currentVarName + " && \"" + call + "\" in " + currentVarName + " )";
        };
        this.elseIn          = function ( currentVarName, call ) {
            return "else " + this.isIn( currentVarName, call );
        };
        this.buildIdentifier = function ( item ) {
            if ( this.isKeyword( item.expression ) ) {
                return item.expression;
            }
            var v   = this.createVar();
            var exp = item.expression,
                p   = this.variablePath.length ? this.variablePath[ this.variablePath.length - 1 ] : SCOPE_NAME;
            this.declarations.push( this.if( p, exp, v ) );
            this.variables.push( v );
            this.variablePath.push( v );
            return v;
        };


        this.currentScope = function () {
            if ( this.lastVariable ) {
                return this.lastVariable;
            } else {
                return SCOPE_NAME;
            }
        };
        this.createVar    = function ( add ) {
            var v = "v" + (varCount + (add || 0));
            if ( add === undefined ) {
                varCount++;
            }
            return v;
        };
        this.isKeyword    = function ( value ) {
            switch ( value ) {
                case "true":
                case "false":
                    return true;
            }
            return false;
        };
        this.resetPath    = function ( item ) {
            switch ( item.type ) {
                case "PLUS":
                case "MINUS":
                case "MULTIPLY":
                    this.lastVariable = "";
                    return true;
            }
            return false;
        };


        this.isFilterExpression   = function ( item, index, lexer ) {
            var _index = index,
                name   = "",
                opened = 0,
                _item  = item;
            if ( !lexer[ index + 1 ] ) {
                return false;
            }

            function openClose() {
                if ( _item ) {
                    if ( _item.value === "(" && lexer[ _index + 1 ] && lexer[ _index + 1 ].value !== ")" ) {
                        open();
                    }
                    else if ( _item.value === ")" && lexer[ _index - 1 ] && lexer[ _index - 1 ].value !== "(" ) {
                        close();
                    }
                }
            }

            function open() {
                opened++;
            }

            function close() {
                opened--;
            }

            function checkValue() {
                switch ( _item.key ) {
                    case "IDENTIFIER":
                    case "DOT":
                    case "NUMBER":
                    case "STRING":
                        return false;
                }
                return true;
            }

            if ( checkValue() ) {
                return false;
            }
            while ( _item && _item.value !== "|" ) {
                openClose();
                if ( checkValue() ) {
                    return false;
                }
                name += _item.value;
                _index++;
                _item = lexer[ _index ];
            }
            _index++;
            _item = lexer[ _index ];
            if ( _item && _item.value !== "|" ) {
                var declaration = {
                    type      : this.type.filter,
                    index     : _index,
                    length    : _index - index,
                    arguments : [],
                    expression: _item.value
                };
                _index++;
                _item = lexer[ _index ];
                declaration.arguments.push( compile( this, name )[ 0 ] );
                while ( _item && _item.value !== ")" ) {
                    if ( _item.value === ":" ) {
                        declaration.arguments.push( { type: "COMMA", expression: "," } );
                        _index++;
                    } else {
                        var part = this.compilePart( _item, _index, lexer );
                        if ( part ) {
                            declaration.arguments.push( part );
                            _index += part.length;
                        } else {
                            _index++;
                        }
                    }
                    _item = lexer[ _index ];
                }
                declaration.length = _index - index;
                return declaration;
            }
        };
        this.isBraceExpression    = function ( item, index, lexer ) {
            var _index = index,
                name   = "",
                open   = false,
                _item  = item;
            if ( !lexer[ index + 1 ] ) {
                return false;
            }
            function checkValue() {
                switch ( _item.key ) {
                    case "IDENTIFIER":
                    case "L_BRACKET":
                    case "NUMBER":
                    case "STRING":
                        return false;
                }
                return true;
            }

            if ( _item.value !== "[" ) {
                return
            }

            while ( _item && _item.value !== "]" ) {
                if ( checkValue() ) {
                    return false;
                }
                if ( _item.value === "[" ) {
                    open = true;
                }
                if ( open ) {
                    name += _item.value;
                }
                _index++;
                _item = lexer[ _index ];
            }

            if ( open ) {
                return {
                    type      : this.type.bracketExpression,
                    index     : _index + 1,
                    length    : (_index - index) + 1,
                    expression: name.substr( 1 )
                };
            }

        };
        this.isFunctionExpression = function ( item, index, lexer ) {
            var _index = index,
                name   = "",
                _item  = item;
            if ( !lexer[ index + 1 ] ) {
                return false;
            }
            function checkValue() {
                switch ( _item.key ) {
                    case "IDENTIFIER":
                    case "DOT":
                        return false;
                }
                return true;
            }

            function openClose() {
                if ( _item ) {
                    if ( _item.value === "(" && lexer[ _index + 1 ] && lexer[ _index + 1 ].value !== ")" ) {
                        open();
                    }
                    else if ( _item.value === ")" && lexer[ _index - 1 ] && lexer[ _index - 1 ].value !== "(" ) {
                        close();
                    }
                }
            }

            function open() {
                opened++;
            }

            function close() {
                opened--;
            }

            if ( checkValue() ) {
                return false;
            }
            while ( _item && _item.value !== "(" ) {
                if ( checkValue() ) {
                    return false;
                }
                name += _item.value;
                _index++;
                _item = lexer[ _index ];
            }
            if ( _index === lexer.length ) {
                return false;
            }
            if ( name[ 0 ] === "." ) {
                name = name.substr( 1 );
            }
            if ( index !== _index ) {
                openClose();
                var declaration = {
                    type      : this.type.function,
                    index     : _index,
                    length    : _index - index,
                    arguments : [],
                    expression: name
                };
                if ( lexer[ _index + 1 ] && lexer[ _index + 1 ].value === ")" ) {
                    declaration.index += 2;
                    declaration.length += 2;
                    return declaration;
                }
                _index++;
                _item = lexer[ _index ];
                while ( _item && (opened > 1 ? true : _item.value !== ")") ) {
                    var part = this.compilePart( _item, _index, lexer );

                    if ( part ) {
                        if ( part.expression !== "," && part.expression !== ")" ) {
                            declaration.arguments.push( part );
                        }
                        _index += part.length;
                    } else {
                        _index++;
                    }
                    openClose();
                    _item = lexer[ _index ];
                }
                //declaration.arguments.pop();
                _index++;
                declaration.length = _index - index;
                return declaration;
            }
            return false;
        };
        this.isExpression         = function ( item, index, lexer ) {
            var _index = index, name = "", _item = item;
            if ( !lexer[ index + 1 ] ) {
                return false;
            }
            function checkValue() {
                switch ( _item.key ) {
                    case "IDENTIFIER":
                    case "DOT":
                        return true;
                }
                return false;
            }

            while ( _item && checkValue() ) {
                name += _item.value;
                _index++;
                _item = lexer[ _index ];
            }
            if ( index !== _index ) {
                return {
                    type      : this.type.expression,
                    index     : _index,
                    length    : _index - index,
                    expression: name
                };
            }
        };


        function compile( self, exp ) {
            var scope = [],
                index = 0,
                lexer = Fancy.lexer( exp ),
                item  = lexer[ index ];
            while ( index < lexer.length ) {
                var part = self.compilePart( item, index, lexer );
                if ( part ) {
                    scope.push( part );
                    index += part.length;
                } else {
                    index++;
                }
                item = lexer[ index ];
            }
            return scope;
        }

        this.compilePart = function ( item, index, lexer ) {
            var isFunctionExpression = this.isFunctionExpression( item, index, lexer );
            if ( isFunctionExpression ) {
                return isFunctionExpression;
            }

            var isFilterExpression = this.isFilterExpression( item, index, lexer );
            if ( isFilterExpression ) {
                return isFilterExpression;
            }

            var isBraceExpression = this.isBraceExpression( item, index, lexer );
            if ( isBraceExpression ) {
                return isBraceExpression;
            }

            var isExpression = this.isExpression( item, index, lexer );
            if ( isExpression ) {
                return isExpression;
            }

            return {
                type      : item.key,
                length    : 1,
                index     : index,
                expression: item.value
            };

        };
        this.compile     = function () {
            var self = this, scope = compile( this, expression );

            function iterateArguments( item ) {
                var arg = "", newVar;
                switch ( item.type ) {
                    case self.type.function:
                        var currentVarName,
                            expressions = item.expression.split( "." ),
                            args        = [],
                            call        = expressions.pop();
                        if ( self.functionCount.length ) {
                            currentVarName = self.functionCount[ self.functionCount.length - 1 ];
                            self.body.pop();
                        } else {
                            currentVarName = self.currentScope();
                            self.functionCount.push( currentVarName );
                        }

                        forEach( item.arguments, function ( argument, i ) {
                            args.push( iterateArguments( argument, i ) );
                        } );

                        if ( expressions.length ) {
                            currentVarName = iterateArguments( {
                                type      : self.type.expression,
                                expression: expressions.join( "." )
                            } );
                        }
                        newVar = self.createVar();
                        self.functionCount.push( newVar );
                        self.declarations.push(
                            self.isIn( currentVarName, call ) + "{" + newVar + " = " + currentVarName + "." + call + "(" + args.join( "," ) + ")} " + self.elseIn( EXTRA_NAME, call ) + " {" + newVar + " = " + EXTRA_NAME + "." + call + "(" + args.join( "," ) + ")} "
                        );
                        //if ( !self.variablePath.length ) {
                        self.variables.push( newVar );
                        //}
                        arg = newVar;
                        if ( self.lastVariable ) {
                            self.body.pop();
                        }
                        self.lastVariable = arg;
                        break;
                    case self.type.identifier:
                        arg               = self.buildIdentifier( item );
                        self.lastVariable = arg;
                        break;
                    case self.type.bracketExpression:
                        newVar = self.createVar( -1 );
                        self.declarations.push( self.notNull( newVar ) + "{ " + newVar + " = " + newVar + "[" + item.expression + "] } else {" + newVar + " = undefined}" );
                        break;
                    case "DOT":
                        if ( self.variablePath.length == 1 ) {
                            return;
                        }
                        arg = ".";
                        break;
                    case self.type.filter:
                        if ( ASTCompiler.filterSupported ) {
                            arg = "$filter(\"" + item.expression + "\")(";
                            forEach( item.arguments, function ( argument, i ) {
                                arg += iterateArguments( argument, i );
                            } );

                            arg += ")";
                        }
                        break;
                    case self.type.expression:
                        forEach( item.expression.split( "." ), function ( item ) {
                            arg = self.buildIdentifier( { type: "IDENTIFIER", expression: item } );
                        } );
                        self.variablePath.push( arg );
                        self.lastVariable = arg;
                        break;
                    default:
                        arg = item.expression;
                }
                self.resetPath( item );
                return arg;
            }

            forEach( scope, function ( item ) {
                var it = iterateArguments( item );
                if ( it ) {
                    self.body.push( it );
                }
            } );

            return this;
        };
        this.generate    = function () {
            var fnString = "\nreturn function(" + SCOPE_NAME + "," + EXTRA_NAME + ") {\n";
            if ( this.variables.length ) {
                fnString += "var " + this.variables.join( ", " ) + ";\n";
            }
            if ( this.declarations.length ) {
                fnString += this.declarations.join( "\n" ) + "\n";
            }
            fnString += "return " + this.body.join( "" ) + ";\n}";
            return fnString;
        };

        return this;
    }

    ASTCompiler.filterSupported = false;
    function forEach( object, callback ) {
        for ( var i in object ) {
            if ( object.hasOwnProperty( i ) ) {
                callback( object[ i ], (i.match( /^\d*$/ ) ? parseInt( i ) : i) );
            }
        }
    }

    ASTCompiler.api = ASTCompiler.prototype = {
        name   : "FancyAST",
        version: "1.0.0"
    };

    Fancy.AST = ASTCompiler;
})( Fancy );