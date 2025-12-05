import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChefHat, UtensilsCrossed, GraduationCap, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ShiftGrid({ carts, shiftTimes, assignments, onAddShift, onEditAssignment }) {
  const getAssignment = (cartId, shiftStart) => {
    return assignments.find(
      a => a.food_cart_id === cartId && a.start_time === shiftStart
    );
  };

  const getShiftBackgroundColor = (assignment) => {
    if (assignment.has_trainee) {
      return "bg-orange-50 border-orange-300";
    }
    return "bg-blue-50 border-blue-200";
  };

  const getWorkerNameColor = (seniority) => {
    if (seniority === "newbie") {
      return "text-blue-600 font-semibold";
    }
    if (seniority === "trainee") {
      return "text-orange-600 font-semibold";
    }
    return "text-blue-900";
  };

  return (
    <div className="space-y-6">
      {carts.map((cart) => (
        <Card key={cart.id} className="border-none shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                🚚
              </div>
              {cart.name}
              <span className="text-sm font-normal opacity-90 ml-2">• {cart.location}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x">
              {shiftTimes.map((shift) => {
                const assignment = getAssignment(cart.id, shift.start);
                const missingChef = assignment && !assignment.chef_id;
                const missingSousChef = assignment && !assignment.sous_chef_id;
                
                return (
                  <div key={shift.start} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-gray-900">
                        {shift.start} - {shift.end}
                      </div>
                      {!assignment && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 hover:bg-blue-50 hover:text-blue-900"
                          onClick={() => onAddShift(cart.id, shift)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {assignment ? (
                      <div
                        onClick={() => onEditAssignment(assignment)}
                        className={`cursor-pointer border rounded-lg p-3 hover:opacity-90 transition-all ${getShiftBackgroundColor(assignment)}`}
                      >
                        {assignment.has_trainee && (
                          <div className="flex items-center gap-1 mb-2 text-xs text-orange-700 font-medium">
                            <GraduationCap className="w-3 h-3" />
                            Training Session
                          </div>
                        )}
                        {assignment.menu && (
                          <div className="flex items-center gap-1 mb-2 text-xs text-amber-700 font-medium">
                            <UtensilsCrossed className="w-3 h-3" />
                            {assignment.menu}
                          </div>
                        )}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <ChefHat className="w-4 h-4 text-blue-900" />
                            {assignment.chef_name ? (
                              <>
                                <span className={`font-medium text-sm ${getWorkerNameColor(assignment.chef_seniority)}`}>
                                  {assignment.chef_name}
                                </span>
                                <Badge variant="outline" className="text-xs">Chef</Badge>
                              </>
                            ) : (
                              <>
                                <span className="text-sm text-gray-400">No chef</span>
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              </>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <ChefHat className="w-4 h-4 text-amber-600" />
                            {assignment.sous_chef_name ? (
                              <>
                                <span className={`font-medium text-sm ${getWorkerNameColor(assignment.sous_chef_seniority)}`}>
                                  {assignment.sous_chef_name}
                                </span>
                                <Badge variant="outline" className="text-xs">Sous-Chef</Badge>
                              </>
                            ) : (
                              <>
                                <span className="text-sm text-gray-400">No sous-chef</span>
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              </>
                            )}
                          </div>
                          
                          {assignment.additional_chef_name && (
                            <div className="flex items-center gap-2">
                              <ChefHat className="w-4 h-4 text-green-600" />
                              <span className="font-medium text-sm text-gray-700">
                                {assignment.additional_chef_name}
                              </span>
                              <Badge variant="outline" className="text-xs">Additional</Badge>
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs mt-2">
                          {assignment.hours}h
                        </Badge>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-400 text-sm">
                        Not assigned
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}