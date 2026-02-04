import React, { useState, useEffect } from "react";
import { FoodCart } from "@/entities/FoodCart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, MapPin, Truck, Power, PowerOff, Hash, Weight, Box } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function FoodCarts() {
  const [carts, setCarts] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCart, setEditingCart] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    description: "",
    serial_number: "",
    weight_category: "light",
    cargo_type: "silver",
    active: true
  });

  useEffect(() => {
    loadCarts();
  }, []);

  const loadCarts = async () => {
    const data = await FoodCart.list("-created_date");
    setCarts(data);
  };

  const handleSubmit = async () => {
    if (editingCart) {
      await FoodCart.update(editingCart.id, formData);
    } else {
      await FoodCart.create(formData);
    }
    setShowDialog(false);
    setEditingCart(null);
    setFormData({ name: "", location: "", description: "", serial_number: "", weight_category: "light", cargo_type: "silver", active: true });
    loadCarts();
  };

  const handleEdit = (cart) => {
    setEditingCart(cart);
    setFormData({
      name: cart.name,
      location: cart.location,
      description: cart.description || "",
      serial_number: cart.serial_number || "",
      weight_category: cart.weight_category || "light",
      cargo_type: cart.cargo_type || "silver",
      active: cart.active
    });
    setShowDialog(true);
  };

  const toggleActive = async (cart) => {
    await FoodCart.update(cart.id, { active: !cart.active });
    loadCarts();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2" dir="rtl">עגלות מזון</h1>
            <p className="text-gray-600" dir="rtl">נהל את צי המטבחים הנייד שלך</p>
          </div>
          <Button 
            onClick={() => setShowDialog(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-6"
            dir="rtl"
          >
            <Plus className="w-4 h-4 mr-2" />
            הוסף עגלת מזון
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {carts.map((cart) => (
            <Card key={cart.id} className="border-none shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col">
              <CardHeader className="border-b bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md">
                      <Truck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{cart.name}</CardTitle>
                      <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                        <MapPin className="w-3 h-3" />
                        {cart.location}
                      </div>
                    </div>
                  </div>
                  <Badge variant={cart.active ? "default" : "secondary"} className={cart.active ? "bg-green-600" : ""} dir="rtl">
                    {cart.active ? "פעיל" : "לא פעיל"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 flex-grow flex flex-col">
                <div className="flex-grow">
                  {cart.description && (
                    <p className="text-sm text-gray-600 mb-4">{cart.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {cart.serial_number && (
                      <Badge variant="outline"><Hash className="w-3 h-3 mr-1" /> S/N: {cart.serial_number}</Badge>
                    )}
                    {cart.weight_category && (
                      <Badge variant="outline"><Weight className="w-3 h-3 mr-1" /> {cart.weight_category.charAt(0).toUpperCase() + cart.weight_category.slice(1)}</Badge>
                    )}
                    {cart.cargo_type && (
                      <Badge variant="outline" className={cart.cargo_type === 'golden' ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-gray-300 bg-gray-50 text-gray-600'}>
                        <Box className="w-3 h-3 mr-1" /> {cart.cargo_type.charAt(0).toUpperCase() + cart.cargo_type.slice(1)} Cargo
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleEdit(cart)}
                    dir="rtl"
                  >
                    <Pencil className="w-3 h-3 mr-2" />
                    ערוך
                  </Button>
                  <Button 
                    variant={cart.active ? "destructive" : "default"}
                    size="sm" 
                    className="flex-1"
                    onClick={() => toggleActive(cart)}
                  >
                    {cart.active ? (
                      <span dir="rtl">
                        <PowerOff className="w-3 h-3 mr-2" />
                        השבת
                      </span>
                    ) : (
                      <span dir="rtl">
                        <Power className="w-3 h-3 mr-2" />
                        הפעל
                      </span>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {carts.length === 0 && (
          <Card className="border-none shadow-lg">
            <CardContent className="py-16 text-center">
              <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2" dir="rtl">עדיין אין עגלות מזון</h3>
              <p className="text-gray-600 mb-6" dir="rtl">הוסף את עגלת המזון הראשונה שלך כדי להתחיל לתכנן משימות</p>
              <Button onClick={() => setShowDialog(true)} className="bg-amber-500 hover:bg-amber-600" dir="rtl">
                <Plus className="w-4 h-4 mr-2" />
                הוסף עגלה ראשונה
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle dir="rtl">{editingCart ? "ערוך עגלת מזון" : "הוסף עגלת מזון חדשה"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Cart Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Downtown Express"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="5th Avenue & Main St"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="serial_number">Serial Number</Label>
                <Input
                  id="serial_number"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value.replace(/\D/g, '').slice(0,3) })}
                  placeholder="e.g., 123"
                  maxLength={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="weight_category">Weight Category</Label>
                  <Select value={formData.weight_category} onValueChange={(value) => setFormData({ ...formData, weight_category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="heavy">Heavy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cargo_type">Cargo Type</Label>
                  <Select value={formData.cargo_type} onValueChange={(value) => setFormData({ ...formData, cargo_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select cargo type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="silver">Silver</SelectItem>
                      <SelectItem value="golden">Golden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional details about this cart..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowDialog(false);
                setEditingCart(null);
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!formData.name || !formData.location}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {editingCart ? "Update" : "Add"} Cart
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}