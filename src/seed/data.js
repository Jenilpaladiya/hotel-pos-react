// Products and tables that match your POS schema
export const seedProducts = [
  {
    id: "1",
    name: "Masala Tea",
    category: "Beverage",
    price: 3.0,
    taxRate: 0.07,
    optionGroups: [
      {
        id: "size",
        label: "Size",
        type: "single",
        required: true,
        min: 1, max: 1,
        options: [
          { id: "reg", name: "Regular", priceDelta: 0 },
          { id: "lg",  name: "Large",   priceDelta: 0.5 },
        ],
      },
      {
        id: "sweet",
        label: "Sweetness",
        type: "single",
        required: false,
        min: 0, max: 1,
        options: [
          { id: "less",   name: "Less Sugar", priceDelta: 0 },
          { id: "normal", name: "Normal",     priceDelta: 0 },
        ],
      },
    ],
  },
  {
    id: "2",
    name: "Paneer Tikka",
    category: "Veg",
    price: 8.5,
    taxRate: 0.07,
    optionGroups: [
      {
        id: "portion",
        label: "Portion",
        type: "single",
        required: true,
        min: 1, max: 1,
        options: [
          { id: "half", name: "Half", priceDelta: 0 },
          { id: "full", name: "Full", priceDelta: 3.0 },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "multi",
        required: false,
        min: 0, max: 3,
        options: [
          { id: "cheese", name: "Extra Cheese", priceDelta: 1.5 },
          { id: "spicy",  name: "Extra Spicy",  priceDelta: 0.5 },
          { id: "dip",    name: "Mint Dip",     priceDelta: 0.7 },
        ],
      },
    ],
  },
  {
    id: "3",
    name: "Butter Naan",
    category: "Bread",
    price: 2.5,
    taxRate: 0.07,
    optionGroups: [],
  },
];

export const seedTables = [
  { id: "t1", label: "T1", seats: 4 },
  { id: "t2", label: "T2", seats: 4 },
  { id: "t3", label: "T3", seats: 4 },
  { id: "t4", label: "T4", seats: 4 },
  { id: "t5", label: "T5", seats: 6 },
  { id: "t6", label: "T6", seats: 2 },
];
