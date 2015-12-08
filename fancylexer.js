(function( Fancy ) {
    var IDENTIFIER = /^[a-zA-Z][a-zA-Z0-9]*/;
    var NUMBER     = /^-?[0-9]+(\.[0-9]+)?/;
    var COMMENT    = /^\/\/.*/;
    var WHITESPACE = /^[^\n\S]+/;
    var INDENT     = /^(?:\n[^\n\S]*)+/;
    var OPTABLE    = {
        '+' : 'PLUS',
        '-' : 'MINUS',
        '*' : 'MULTIPLY',
        '.' : 'DOT',
        '\\': 'BACKSLASH',
        ':' : 'COLON',
        '%' : 'PERCENT',
        '|' : 'PIPE',
        '!' : 'EXCLAMATION',
        '?' : 'QUESTION',
        '#' : 'POUND',
        '&' : 'AMPERSAND',
        ';' : 'SEMI',
        ',' : 'COMMA',
        '(' : 'L_PARENTHESIS',
        ')' : 'R_PARENTHESIS',
        '<' : 'L_ANG',
        '>' : 'R_ANG',
        '{' : 'L_BRACE',
        '}' : 'R_BRACE',
        '[' : 'L_BRACKET',
        ']' : 'R_BRACKET',
        '=' : 'EQUALS'
    };

    function Lexer( expression ) {
        if( !(this instanceof Lexer) ) {
            return new Lexer( expression );
        }
        this.tokens = [];
        this.indent = 0;
        this.chunk  = undefined;
        return this.tokenise( expression );
    }

    Lexer.api = Lexer.prototype = {};
    Lexer.api.identifier = function() {
        var value,
            token = IDENTIFIER.exec( this.chunk );
        if( token ) {
            value = token[ 0 ];
            this.tokens.push( [ "IDENTIFIER", value ] );
            return value.length;
        }

        return 0;
    };
    Lexer.api.number     = function() {
        var token = NUMBER.exec( this.chunk );
        if( token ) {
            this.tokens.push( [ 'NUMBER', token[ 0 ] ] );
            return token[ 0 ].length;
        }

        return 0;
    };
    Lexer.api.string     = function() {
        var firstChar = this.chunk.charAt( 0 ),
            quoted    = false,
            nextChar;
        if( firstChar == '"' || firstChar == "'" ) {
            for( var i = 1; i < this.chunk.length; i++ ) {
                if( !quoted ) {
                    nextChar = this.chunk.charAt( i );
                    if( nextChar == "\\" ) {
                        quoted = true;
                    } else if( nextChar == firstChar ) {
                        this.tokens.push( [ 'STRING', this.chunk.substring( 0, i + 1 ) ] );
                        return i + 1;
                    }
                } else {
                    quoted = false;
                }
            }
        }

        return 0;
    };
    Lexer.api.comment    = function() {
        var token = COMMENT.exec( this.chunk );
        if( token ) {
            this.tokens.push( [ 'COMMENT', token[ 0 ] ] );
            return token[ 0 ].length;
        }

        return 0;
    };
    Lexer.api.whitespace = function() {
        var token = WHITESPACE.exec( this.chunk );
        if( token ) {
            return token[ 0 ].length;
        }

        return 0;
    };
    Lexer.api.line       = function() {
        var token = INDENT.exec( this.chunk );
        if( token ) {
            var lastNewline = token[ 0 ].lastIndexOf( "\n" ) + 1;
            var size        = token[ 0 ].length - lastNewline;
            if( size > this.indent ) {
                this.tokens.push( [ 'INDENT', size - this.indent ] );
            } else {
                if( size < this.indent ) {
                    this.tokens.push( [ 'OUTDENT', this.indent - size ] );
                }
                this.tokens.push( [ 'TERMINATOR', token[ 0 ].substring( 0, lastNewline ) ] );
            }
            this.indent = size;
            return token[ 0 ].length;
        }

        return 0;
    };
    Lexer.api.literal    = function() {
        var tag = this.chunk.slice( 0, 1 );
        if( OPTABLE[ tag ] ) {
            this.tokens.push( [ OPTABLE[ tag ], tag ] );
            return 1;
        }

        return 0;
    };
    Lexer.api.tokenise   = function( source ) {
        var i = 0;
        while( this.chunk = source.slice( i ) ) {
            var diff = this.identifier() || this.number() || this.string() || this.comment() || this.whitespace() || this.line() || this.literal();
            if( !diff ) {
                console.error( "Couldn't tokenise: " + this.chunk + " near \"" + source.slice( Math.max( 0, i - 15 ), i + 15 ) + "\"" );
                return;
            }
            i += diff;
        }

        return this.tokens;
    };
    Fancy.lexer          = Lexer;
})( Fancy );