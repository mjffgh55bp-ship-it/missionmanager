import Availability from './pages/Availability';
import Dashboard from './pages/Dashboard';
import FoodCarts from './pages/FoodCarts';
import Home from './pages/Home';
import Matrix from './pages/Matrix';
import Qualifications from './pages/Qualifications';
import Reports from './pages/Reports';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import Workers from './pages/Workers';
import Yearly from './pages/Yearly';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Availability": Availability,
    "Dashboard": Dashboard,
    "FoodCarts": FoodCarts,
    "Home": Home,
    "Matrix": Matrix,
    "Qualifications": Qualifications,
    "Reports": Reports,
    "Schedule": Schedule,
    "Settings": Settings,
    "Workers": Workers,
    "Yearly": Yearly,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};