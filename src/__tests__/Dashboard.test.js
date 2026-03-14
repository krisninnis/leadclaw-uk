import { render, screen } from "@testing-library/react";
import Dashboard from "../components/Dashboard"; // Your actual component

test("renders dashboard", () => {
  render(<Dashboard />);
  expect(
    screen.getByText(/Welcome to the Admin Dashboard/),
  ).toBeInTheDocument();
});
