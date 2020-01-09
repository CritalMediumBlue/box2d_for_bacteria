/*
* Copyright (c) 2006-2009 Erin Catto http://www.box2d.org
*
* This software is provided 'as-is', without any express or implied
* warranty.  In no event will the authors be held liable for any damages
* arising from the use of this software.
* Permission is granted to anyone to use this software for any purpose,
* including commercial applications, and to alter it and redistribute it
* freely, subject to the following restrictions:
* 1. The origin of this software must not be misrepresented; you must not
* claim that you wrote the original software. If you use this software
* in a product, an acknowledgment in the product documentation would be
* appreciated but is not required.
* 2. Altered source versions must be plainly marked as such, and must not be
* misrepresented as being the original software.
* 3. This notice may not be removed or altered from any source distribution.
*/
System.register(["../../Collision/b2CollidePolygon.js", "./b2Contact.js"], function (exports_1, context_1) {
    "use strict";
    var b2CollidePolygon_js_1, b2Contact_js_1, b2PolygonContact;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (b2CollidePolygon_js_1_1) {
                b2CollidePolygon_js_1 = b2CollidePolygon_js_1_1;
            },
            function (b2Contact_js_1_1) {
                b2Contact_js_1 = b2Contact_js_1_1;
            }
        ],
        execute: function () {
            b2PolygonContact = class b2PolygonContact extends b2Contact_js_1.b2Contact {
                static Create() {
                    return new b2PolygonContact();
                }
                static Destroy(contact) {
                }
                Evaluate(manifold, xfA, xfB) {
                    b2CollidePolygon_js_1.b2CollidePolygons(manifold, this.GetShapeA(), xfA, this.GetShapeB(), xfB);
                }
            };
            exports_1("b2PolygonContact", b2PolygonContact);
        }
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYjJQb2x5Z29uQ29udGFjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImIyUG9seWdvbkNvbnRhY3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7RUFnQkU7Ozs7Ozs7Ozs7Ozs7OztZQVFGLG1CQUFBLE1BQWEsZ0JBQWlCLFNBQVEsd0JBQXlDO2dCQUN0RSxNQUFNLENBQUMsTUFBTTtvQkFDbEIsT0FBTyxJQUFJLGdCQUFnQixFQUFFLENBQUM7Z0JBQ2hDLENBQUM7Z0JBRU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFrQjtnQkFDeEMsQ0FBQztnQkFFTSxRQUFRLENBQUMsUUFBb0IsRUFBRSxHQUFnQixFQUFFLEdBQWdCO29CQUN0RSx1Q0FBaUIsQ0FDZixRQUFRLEVBQ1IsSUFBSSxDQUFDLFNBQVMsRUFBRSxFQUFFLEdBQUcsRUFDckIsSUFBSSxDQUFDLFNBQVMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUMzQixDQUFDO2FBQ0YsQ0FBQSJ9