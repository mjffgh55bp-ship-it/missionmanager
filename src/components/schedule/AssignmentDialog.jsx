import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, Star } from "lucide-react";

export default function AssignmentDialog({ open, onOpenChange, selectedShift, workers, carts, onSave }) {
  const [formData, setFormData] = useState({
    chef_id: "",
    sous_chef_id: "",
    additional_chef_id: "",
    start_time: "",
    end_time: "",
    hours: 4,
    menu: "",
    notes: ""
  });
  const [availabilities, setAvailabilities] = useState([]);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (open && selectedShift) {
      loadAvailabilities();
    }
  }, [open, selectedShift]);

  const loadAvailabilities = async () => {
    if (selectedShift?.date) {
      const weekStart = new Date(selectedShift.date);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      const weekStartStr = weekStart.toISOString().split('T')[0];
      
      const avails = await base44.entities.Availability.filter({ 
        week_start_date: weekStartStr,
        status: "approved"
      });
      setAvailabilities(avails);
    }
  };

  useEffect(() => {
    if (selectedShift) {
      if (selectedShift.id) {
        setFormData({
          chef_id: selectedShift.chef_id || "",
          sous_chef_id: selectedShift.sous_chef_id || "",
          additional_chef_id: selectedShift.additional_chef_id || "",
          start_time: selectedShift.start_time,
          end_time: selectedShift.end_time,
          hours: selectedShift.hours,
          menu: selectedShift.menu || "",
          notes: selectedShift.notes || ""
        });
      } else {
        setFormData({
          chef_id: "",
          sous_chef_id: "",
          additional_chef_id: "",
          start_time: selectedShift.start_time,
          end_time: selectedShift.end_time,
          hours: 4,
          menu: "",
          notes: ""
        });
      }
    }
    setValidationError("");
  }, [selectedShift]);

  const calculateHours = (start, end) => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    let hours = endHour - startHour;
    if (endHour < startHour) hours += 24;
    hours += (endMin - startMin) / 60;
    return Math.max(0, hours);
  };

  useEffect(() => {
    if (formData.start_time && formData.end_time) {
      const calculatedHours = calculateHours(formData.start_time, formData.end_time);
      setFormData(prev => ({ ...prev, hours: calculatedHours }));
    }
  }, [formData.start_time, formData.end_time]);

  const validateAssignment = () => {
    const chef = workers.find(w => w.id === formData.chef_id);
    const sousChef = workers.find(w => w.id === formData.sous_chef_id);
    const additionalChef = formData.additional_chef_id 
      ? workers.find(w => w.id === formData.additional_chef_id)
      : null;

    const allWorkers = [chef, sousChef, additionalChef].filter(Boolean);
    const trainees = allWorkers.filter(w => w.seniority === "trainee");
    const guides = allWorkers.filter(w => w.is_guide);

    if (trainees.length > 0 && guides.length === 0) {
      setValidationError("Trainees must work with a Guide");
      return false;
    }

    setValidationError("");
    return true;
  };

  useEffect(() => {
    if (formData.chef_id || formData.sous_chef_id || formData.additional_chef_id) {
      validateAssignment();
    }
  }, [formData.chef_id, formData.sous_chef_id, formData.additional_chef_id]);

  const getWorkerAvailabilityPriority = (workerId) => {
    const workerAvail = availabilities.find(a => a.worker_id === workerId);
    if (!workerAvail || !workerAvail.shifts) return null;
    
    const dateString = selectedShift.date;
    const shift = workerAvail.shifts.find(s => 
      s.date === dateString && 
      formData.start_time >= s.start_time && 
      formData.end_time <= s.end_time
    );
    
    return shift?.priority || null;
  };

  const isWorkerAvailable = (workerId) => {
    return getWorkerAvailabilityPriority(workerId) !== null;
  };

  const sortWorkersByAvailability = (workersList) => {
    return workersList.sort((a, b) => {
      const aPriority = getWorkerAvailabilityPriority(a.id);
      const bPriority = getWorkerAvailabilityPriority(b.id);
      
      if (aPriority === null && bPriority === null) return 0;
      if (aPriority === null) return 1;
      if (bPriority === null) return -1;
      
      return aPriority - bPriority;
    });
  };

  const handleSubmit = async () => {
    if (!validateAssignment()) {
      return;
    }

    const chef = workers.find(w => w.id === formData.chef_id);
    const sousChef = workers.find(w => w.id === formData.sous_chef_id);
    const selectedCart = carts.find(c => c.id === selectedShift.food_cart_id);
    const additionalChef = formData.additional_chef_id 
      ? workers.find(w => w.id === formData.additional_chef_id)
      : null;

    const allWorkers = [chef, sousChef, additionalChef].filter(Boolean);
    const hasTrainee = allWorkers.some(w => w.seniority === "trainee");

    const assignmentData = {
      date: selectedShift.date,
      chef_id: formData.chef_id || null,
      chef_name: chef ? chef.full_name : null,
      chef_seniority: chef ? chef.seniority : null,
      sous_chef_id: formData.sous_chef_id || null,
      sous_chef_name: sousChef ? sousChef.full_name : null,
      sous_chef_seniority: sousChef ? sousChef.seniority : null,
      additional_chef_id: formData.additional_chef_id || null,
      additional_chef_name: additionalChef ? additionalChef.full_name : null,
      additional_chef_role: additionalChef ? additionalChef.role : null,
      food_cart_id: selectedShift.food_cart_id,
      food_cart_name: selectedCart.name,
      start_time: formData.start_time,
      end_time: formData.end_time,
      hours: formData.hours,
      menu: formData.menu,
      notes: formData.notes,
      has_trainee: hasTrainee
    };

    if (selectedShift.id) {
      await base44.entities.Assignment.update(selectedShift.id, assignmentData);
    } else {
      await base44.entities.Assignment.create(assignmentData);
    }

    onOpenChange(false);
    onSave();
  };

  const handleDelete = async () => {
    if (selectedShift?.id) {
      await base44.entities.Assignment.delete(selectedShift.id);
      onOpenChange(false);
      onSave();
    }
  };

  if (!selectedShift) return null;

  const chefs = sortWorkersByAvailability(workers.filter(w => w.role === 'chef'));
  const sousChefs = sortWorkersByAvailability(workers.filter(w => w.role === 'sous_chef'));
  const additionalOptions = sortWorkersByAvailability(workers.filter(w => 
    w.id !== formData.chef_id && w.id !== formData.sous_chef_id
  ));

  const WorkerSelectItem = ({ worker }) => {
    const available = isWorkerAvailable(worker.id);
    const priority = getWorkerAvailabilityPriority(worker.id);
    
    return (
      <SelectItem value={worker.id}>
        <div className="flex items-center gap-2">
          {available && <Check className="w-3 h-3 text-green-600" />}
          {priority && priority <= 3 && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
          <span>{worker.full_name}</span>
          <Badge variant="outline" className="text-xs ml-2">{worker.seniority}</Badge>
          {worker.is_guide && <Badge className="text-xs bg-yellow-100 text-yellow-800">Guide</Badge>}
          {priority && <Badge variant="outline" className="text-xs">P{priority}</Badge>}
        </div>
      </SelectItem>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedShift.id ? "Edit Assignment" : "New Assignment"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {validationError}
            </div>
          )}

          <div>
            <Label>Chef *</Label>
            <Select 
              value={formData.chef_id} 
              onValueChange={(value) => setFormData({ ...formData, chef_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select chef" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {chefs.map((worker) => (
                  <WorkerSelectItem key={worker.id} worker={worker} />
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Sous-Chef *</Label>
            <Select 
              value={formData.sous_chef_id} 
              onValueChange={(value) => setFormData({ ...formData, sous_chef_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sous-chef" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {sousChefs.map((worker) => (
                  <WorkerSelectItem key={worker.id} worker={worker} />
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Additional Chef (Optional)</Label>
            <Select 
              value={formData.additional_chef_id} 
              onValueChange={(value) => setFormData({ ...formData, additional_chef_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select additional chef (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {additionalOptions.map((worker) => (
                  <WorkerSelectItem key={worker.id} worker={worker} />
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Menu (One Word)</Label>
            <Input
              value={formData.menu}
              onChange={(e) => setFormData({ ...formData, menu: e.target.value })}
              placeholder="e.g., Tacos, Burgers, Sushi"
              maxLength={20}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Time *</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>
            <div>
              <Label>End Time *</Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Hours</Label>
            <Input
              type="number"
              step="0.5"
              value={formData.hours}
              onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) })}
              disabled
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {selectedShift.id && (
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              className="w-full sm:w-auto"
            >
              Delete
            </Button>
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.start_time || !formData.end_time || !!validationError}
              className="bg-blue-900 hover:bg-blue-800 flex-1 sm:flex-none"
            >
              {selectedShift.id ? "Update" : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}