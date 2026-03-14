// src/__tests__/Dashboard.test.js
import { render, screen } from "@testing-library/react";
import Dashboard from "../components/Dashboard"; // Ensure the path is correct

test("renders dashboard", () => {
  render(<Dashboard />);
  expect(
    screen.getByText(/Welcome to the Admin Dashboard/),
  ).toBeInTheDocument();
});
