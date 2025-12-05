import Dashboard from './pages/Dashboard';
import Workers from './pages/Workers';
import FoodCarts from './pages/FoodCarts';
import Schedule from './pages/Schedule';
import Reports from './pages/Reports';
import Matrix from './pages/Matrix';
import Availability from './pages/Availability';
import Qualifications from './pages/Qualifications';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Workers": Workers,
    "FoodCarts": FoodCarts,
    "Schedule": Schedule,
    "Reports": Reports,
    "Matrix": Matrix,
    "Availability": Availability,
    "Qualifications": Qualifications,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};