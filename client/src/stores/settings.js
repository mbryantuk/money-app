import { defineStore } from 'pinia';
import axios from 'axios';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    currentMonth: '',
    defaultSalary: 0,
    payDay: 19,
    categories: [],
    people: [],
    templates: [],
    isLoading: false
  }),

  actions: {
    getPayDate(year, month) {
      let d = new Date(year, month, this.payDay);
      const day = d.getDay();
      if (day === 0) d.setDate(d.getDate() - 2);
      else if (day === 6) d.setDate(d.getDate() - 1);
      return d.getDate();
    },

    determineCurrentFinancialMonth() {
      const today = new Date();
      const y = today.getFullYear();
      const m = today.getMonth();
      const d = today.getDate();

      const payDayThisMonth = this.getPayDate(y, m);

      if (d < payDayThisMonth) {
        const prevDate = new Date(y, m - 1, 1);
        this.currentMonth = prevDate.toISOString().slice(0, 7);
      } else {
        this.currentMonth = new Date(y, m, 1).toISOString().slice(0, 7);
      }
    },

    async fetchSettings() {
      this.isLoading = true;
      try {
        const API_URL = '/api';
        const res = await axios.get(`${API_URL}/settings`);
        
        if (res.data.default_salary) this.defaultSalary = parseFloat(res.data.default_salary);
        if (res.data.pay_day) this.payDay = parseInt(res.data.pay_day);

        if (res.data.categories) this.categories = JSON.parse(res.data.categories);
        else this.categories = ['Housing', 'Utilities', 'Food', 'Insurance', 'Subscription', 'Mobile', 'Savings', 'Spending', 'Medical', 'Tax'];

        if (res.data.people) this.people = JSON.parse(res.data.people);
        else this.people = ['Joint', 'f1', 'f2', 's', 'Matt'];

        const tRes = await axios.get(`${API_URL}/templates`);
        this.templates = tRes.data || [];

        this.determineCurrentFinancialMonth();
      } catch (e) {
        console.error("Settings Error", e);
        throw e;
      } finally {
        this.isLoading = false;
      }
    }
  }
});