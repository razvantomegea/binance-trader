AGENTS.md
This file provides guidance to all agents, LLMs, and AI tools when working with code in this repository. These are a mandatory.

### Documentation

The project documentation is in @README.md

## Rules

- Never write code with Claude Opus or GPT 5.5
- Always use GPT for complex tasks implementations and Claude for UI/UX design
- The plan must be very specific with small chunks, with code samples, and with explanations on each part for the reasoning.
- Before writing a new component, function, class, type, interface, etc., search the codebase for similar code to not duplicate (DRY principle)
- When the accuracy is less than 95% and when in doubt, don't assume or hallucinate. Ask the user questions and if the user is not sure, search the web and documentations.
- Never modify tests unless the user approves
- Always use strict types and object params for more than 2 params
- Always do what asked and nothing more
- Never mask a problem, always find root cause
- Avoid monolithic files, extract reusable testable and simple code blocks outside in utils (pure utility functions), types (type, interface, union, etc.), constants (const, enum, etc.), components (React components), helpers (classes, managers, services, business logic etc.)
- Use as few words as possible. Think and "speak" (write) telegraphically like a robot to reduce token usage (energy) as much as possible (use caveman skill).
- Be critical and think like an experienced software engineer. Focus on facts, not opinions.
- Write as little code as possible and keep things as simple as possible. The less code written, the better.
- Never read .env files
