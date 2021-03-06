// Copyright (c) 2017, Patrick Quist
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.
"use strict";

class PascalDemangler {
    constructor() {
        this.symbolcache = {};
        this.sortedsymbolcache = [];
        this.fixedsymbols = {};
        this.ignoredsymbols = [];

        this.initBasicSymbols();
    }

    initBasicSymbols() {
        this.fixedsymbols.OUTPUT_$$_init = 'unit_initialization';
        this.fixedsymbols.OUTPUT_$$_finalize = 'unit_finalization';
        this.fixedsymbols.OUTPUT_$$_init_implicit = 'unit_initialization_implicit';
        this.fixedsymbols.OUTPUT_$$_finalize_implicit ='unit_finalization_implicit';
        this.fixedsymbols.OUTPUT_init = 'unit_initialization';
        this.fixedsymbols.OUTPUT_finalize = 'unit_finalization';
        this.fixedsymbols.OUTPUT_init_implicit = 'unit_initialization_implicit';
        this.fixedsymbols.OUTPUT_finalize_implicit = 'unit_finalization_implicit';

        this.ignoredsymbols = [
            ".L",
            "VMT_$", "INIT_$", "INIT$_$", "FINALIZE$_$", "RTTI_$",
            "VMT_OUTPUT_", "INIT$_OUTPUT", "RTTI_OUTPUT_", "FINALIZE$_OUTPUT",
            "_$",
            "DEBUGSTART_$", "DEBUGEND_$", "DBG_$", "DBG2_$", "DBGREF_$",
            "DEBUGSTART_OUTPUT", "DEBUGEND_OUTPUT", "DBG_OUTPUT_", "DBG2_OUTPUT_", "DBGREF_OUTPUT_"
        ];
    }

    shouldIgnoreSymbol(text) {
        for (var k in this.ignoredsymbols) {
            if (text.startsWith(this.ignoredsymbols[k])) {
                return true;
            }
        }

        return false;
    }

    composeReadableMethodSignature(unitname, classname, methodname, params) {
        var signature = "";

        if (classname != "") signature = classname.toLowerCase() + ".";

        signature = signature + methodname.toLowerCase();
        signature = signature + "(" + params.toLowerCase() + ")";

        return signature;
    }

    demangle(text) {
        if (text.endsWith(':')) {
            if (this.shouldIgnoreSymbol(text)) {
                return false;
            }

            text = text.substr(0, text.length - 1);

            for (var k in this.fixedsymbols) {
                if (text == k) {
                    text = text.replace(k, this.fixedsymbols[k]);
                    this.symbolcache[k] = this.fixedsymbols[k];
                    return this.fixedsymbols[k];
                }
            }

            var unmangledglobalvar;
            if (text.startsWith("U_$OUTPUT_$$_")) {
                unmangledglobalvar = text.substr(13).toLowerCase();
                this.symbolcache[text] = unmangledglobalvar;
                return unmangledglobalvar;
            } else if (text.startsWith("U_OUTPUT_")) {
                unmangledglobalvar = text.substr(9).toLowerCase();
                this.symbolcache[text] = unmangledglobalvar;
                return unmangledglobalvar;
            }

            var idx, paramtype = "", signature = "", phase = 0;
            var unitname = "", classname = "", methodname = "", params = "", resulttype = "";

            idx = text.indexOf("$_$");
            if (idx != -1) {
                unitname = text.substr(0, idx - 1);
                classname = text.substr(idx + 3, text.indexOf("_$_", idx + 2) - idx - 3);
            }

            signature = "";
            idx = text.indexOf("_$$_");
            if (idx != -1) {
                if (unitname == "") unitname = text.substr(0, idx - 1);
                signature =  text.substr(idx + 3);
            }

            if (unitname == "") {
                idx = text.indexOf("OUTPUT_");
                if (idx != -1) {
                    unitname = "OUTPUT";

                    idx = text.indexOf("_$__");
                    if (idx != -1) {
                        classname = text.substr(7, idx - 7);
                        signature = text.substr(idx + 3);
                    } else {
                        signature = text.substr(6);
                    }
                }
            }

            if (signature != "") {
                for (idx = 1; idx < signature.length; idx++) {
                    if (signature[idx] == '$') {
                        if (phase == 0) phase = 1;
                        else if (phase == 1) {
                            if (paramtype == "") phase = 2;
                            else if (params != "") {
                                params = params + "," + paramtype;
                                paramtype = "";
                            } else if (params == "") {
                                params = paramtype;
                                paramtype = "";
                            }
                        }
                    } else {
                        if (phase == 0) methodname = methodname + signature[idx];
                        else if (phase == 1) paramtype = paramtype + signature[idx];
                        else if (phase == 2) resulttype = resulttype + signature[idx];
                    }
                }

                if (paramtype != "") {
                    if (params != "") params = params + "," + paramtype;
                    else params = paramtype;
                }
            }

            this.symbolcache[text] = this.composeReadableMethodSignature(unitname, classname, methodname, params);
            return this.symbolcache[text];
        }

        return false;
    }

    addDemangleToCache(text) {
        this.demangle(text);
    }

    buildOrderedCache() {
        this.sortedsymbolcache = [];
        for (var symbol in this.symbolcache) {
            this.sortedsymbolcache.push([symbol, this.symbolcache[symbol]]);
        }

        this.sortedsymbolcache = this.sortedsymbolcache.sort(function(a, b) {
            return b[0].length - a[0].length;
        });

        this.symbolcache = {};
    }

    demangleIfNeeded(text) {
        if (text.includes('$')) {
            if (this.shouldIgnoreSymbol(text)) {
                return text;
            }

            for (var idx in this.sortedsymbolcache) {
                text = text.replace(this.sortedsymbolcache[idx][0], this.sortedsymbolcache[idx][1]);
            }

            return text;
        } else {
            return text;
        }
    }
}

exports.demangler = PascalDemangler;
