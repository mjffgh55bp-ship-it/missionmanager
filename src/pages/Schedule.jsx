import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MenuButton from "../components/MenuButton";

export default function Schedule() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <MenuButton />
      <div className="max-w-screen-2xl mx-auto">
        <Card className="border-none shadow-lg">
          <CardHeader className="border-b bg-white">
            <CardTitle className="text-2xl" dir="rtl">לוח</CardTitle>
          </CardHeader>
          <CardContent className="py-16 text-center">
            <p className="text-gray-600" dir="rtl">התחל לבנות את הלוח שלך</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}