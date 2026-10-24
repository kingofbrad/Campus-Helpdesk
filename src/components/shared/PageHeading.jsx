import { Heading, Text } from "@chakra-ui/react";

export default function PageHeading({ eyebrow, title, subtitle, children }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <Heading size="xl" mt="1" mb="1">{title}</Heading>
        <Text color="gray.600">{subtitle}</Text>
      </div>
      {children}
    </div>
  );
}

