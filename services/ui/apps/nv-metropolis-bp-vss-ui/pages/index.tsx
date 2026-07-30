// SPDX-License-Identifier: MIT
import { GetServerSideProps } from 'next';
import Head from 'next/head';

import Home from '../components/Home';
import { APPLICATION_TITLE } from '../constants/constants';

// Server-side props with data fetching
// services/ui/apps/nv-metropolis-bp-vss-ui/pages/index.tsx

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const { getNemoAgentToolkitSSProps } = await import(
      '@nemo-agent-toolkit/ui/server'
    );

    const {
      fetchSearchData,
      fetchVideoManagementData,
    } = await import(
      '@nv-metropolis-bp-vss-ui/all/server'
    );

    const [
      nemoProps,
      searchData,
      videoManagementData,
    ] = await Promise.all([
      getNemoAgentToolkitSSProps(context),
      fetchSearchData(),
      fetchVideoManagementData(),
    ]);

    return {
      props: {
        ...nemoProps.props,

        alertsData: null,
        searchData,
        dashboardData: null,
        mapData: null,

        videoManagementData,

        serverRenderTime: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);

    return {
      props: {
        alertsData: null,
        searchData: null,
        dashboardData: null,
        mapData: null,
        videoManagementData: null,
        serverRenderTime: new Date().toISOString(),
      },
    };
  }
};

// Props interface matching what getServerSideProps returns
interface HomePageProps {
  alertsData?: any;
  dashboardData?: any;
  mapData?: any;
  searchData?: any;
  videoManagementData?: any;
  serverRenderTime?: string;
}

export default function HomePage(props: HomePageProps) {
  // Pass all SSR props to Home component
  return (
    <>
      <Head>
        <title>{APPLICATION_TITLE}</title>
      </Head>
      <Home {...props} />
    </>
  );
}